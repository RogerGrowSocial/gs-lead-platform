/**
 * Performance Logging Middleware
 * Logs detailed timing information for requests, middleware, database queries, and rendering
 */

const performanceLog = (req, res, next) => {
  // Skip logging for static assets and favicon
  if (req.path.startsWith('/css/') || 
      req.path.startsWith('/js/') || 
      req.path.startsWith('/images/') || 
      req.path.startsWith('/uploads/') ||
      req.path === '/favicon.ico') {
    return next();
  }

  const startTime = process.hrtime.bigint();
  const startTimestamp = Date.now();
  const timings = {
    requestStart: startTimestamp,
    middleware: {},
    database: [],
    rendering: null,
    routeHandler: null,
    total: null
  };

  // Store timings in request object for other middleware to use
  req.performanceTimings = timings;
  req.performanceStart = startTime;

  // Override res.render to track rendering time
  const originalRender = res.render;
  res.render = function(view, options, callback) {
    const renderStart = process.hrtime.bigint();
    const renderStartMs = Date.now();
    
    const wrappedCallback = (err, html) => {
      const renderEnd = process.hrtime.bigint();
      const renderTime = Number(renderEnd - renderStart) / 1000000; // Convert to ms
      timings.rendering = {
        view: view,
        time: renderTime,
        timestamp: renderStartMs
      };
      
      if (callback) {
        callback(err, html);
      } else if (err) {
        res.req.next(err);
      } else {
        res.send(html);
      }
    };

    return originalRender.call(this, view, options, wrappedCallback);
  };

  // Track database queries by intercepting require calls and wrapping Supabase
  // We'll track queries at the route level instead since wrapping Supabase client is complex
  // Routes can manually track queries using req.performanceTimings.database.push()

  // Log when response finishes
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const totalTime = Number(endTime - startTime) / 1000000; // Convert to ms
    timings.total = totalTime;

    // Calculate route handler time (if not already set)
    if (!timings.routeHandler && timings.total) {
      const middlewareTime = Object.values(timings.middleware).reduce((sum, t) => sum + (t || 0), 0);
      const dbTime = timings.database.reduce((sum, q) => sum + (q.totalTime || 0), 0);
      const renderTime = timings.rendering ? timings.rendering.time : 0;
      timings.routeHandler = Math.max(0, totalTime - middlewareTime - dbTime - renderTime);
    }

    // Build detailed log
    const logParts = [
      `\n${'='.repeat(80)}`,
      `🚀 PERFORMANCE: ${req.method} ${req.path}`,
      `Status: ${res.statusCode} | Total: ${totalTime.toFixed(2)}ms`,
      `IP: ${req.ip} | User: ${req.user?.id || 'anonymous'}`,
    ];

    // Middleware timings
    if (Object.keys(timings.middleware).length > 0) {
      logParts.push(`\n  📦 Middleware:`);
      Object.entries(timings.middleware)
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .forEach(([name, time]) => {
          const percentage = ((time / totalTime) * 100).toFixed(1);
          logParts.push(`    ${name.padEnd(30)} ${time.toFixed(2).padStart(8)}ms (${percentage.padStart(5)}%)`);
        });
    }

    // Database queries
    if (timings.database.length > 0) {
      const totalDbTime = timings.database.reduce((sum, q) => sum + (q.totalTime || 0), 0);
      const dbPercentage = ((totalDbTime / totalTime) * 100).toFixed(1);
      logParts.push(`\n  🗄️  Database (${timings.database.length} queries, ${totalDbTime.toFixed(2)}ms total, ${dbPercentage}%):`);
      timings.database.slice(0, 10).forEach((query, idx) => { // Limit to 10 queries in log
        const status = query.hasError ? '❌' : '✅';
        const rowInfo = query.rowCount ? ` (${query.rowCount} rows)` : '';
        logParts.push(`    ${status} ${query.method || 'query'}(${query.table}) ${(query.totalTime || 0).toFixed(2)}ms${rowInfo}`);
        if (query.error) {
          logParts.push(`        Error: ${query.error}`);
        }
      });
      if (timings.database.length > 10) {
        logParts.push(`    ... and ${timings.database.length - 10} more queries`);
      }
    }

    // Rendering time
    if (timings.rendering) {
      const renderPercentage = ((timings.rendering.time / totalTime) * 100).toFixed(1);
      logParts.push(`\n  🎨 Rendering:`);
      logParts.push(`    View: ${timings.rendering.view}`);
      logParts.push(`    Time: ${timings.rendering.time.toFixed(2)}ms (${renderPercentage}%)`);
    }

    // Route handler time
    if (timings.routeHandler !== null && timings.routeHandler > 0) {
      const handlerPercentage = ((timings.routeHandler / totalTime) * 100).toFixed(1);
      logParts.push(`\n  ⚙️  Route Handler:`);
      logParts.push(`    Time: ${timings.routeHandler.toFixed(2)}ms (${handlerPercentage}%)`);
    }

    // Performance warnings
    const warnings = [];
    if (totalTime > 1000) warnings.push(`⚠️  SLOW: Total time > 1s`);
    if (totalTime > 3000) warnings.push(`🐌 VERY SLOW: Total time > 3s`);
    
    const totalDbTime = timings.database.reduce((sum, q) => sum + (q.totalTime || 0), 0);
    if (totalDbTime > 500) warnings.push(`⚠️  DB: Total DB time > 500ms`);
    if (timings.database.length > 10) warnings.push(`⚠️  DB: ${timings.database.length} queries (consider batching)`);
    if (timings.database.length > 20) warnings.push(`🚨 DB: ${timings.database.length} queries (CRITICAL - needs optimization)`);
    
    if (timings.rendering && timings.rendering.time > 200) warnings.push(`⚠️  RENDER: Rendering time > 200ms`);
    if (timings.rendering && timings.rendering.time > 500) warnings.push(`🐌 RENDER: Rendering time > 500ms`);
    
    if (warnings.length > 0) {
      logParts.push(`\n  ⚠️  WARNINGS:`);
      warnings.forEach(w => logParts.push(`    ${w}`));
    }

    logParts.push(`${'='.repeat(80)}\n`);

    // Always log for admin routes, API routes, or if slow/warnings/queries exist
    const isImportantRoute = req.path.startsWith('/admin/') || 
                             req.path.startsWith('/api/') || 
                             req.path.startsWith('/dashboard');
    
    if (isImportantRoute || totalTime > 50 || warnings.length > 0 || timings.database.length > 0) {
      console.log(logParts.join('\n'));
    }
  });

  next();
};

module.exports = {
  performanceLog
};
