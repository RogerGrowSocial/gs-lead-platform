const { PrismaClient } = require('@prisma/client');

// LAZY INITIALIZATION: Only create PrismaClient when first accessed
// This prevents blocking server startup if database isn't reachable
// (especially after laptop wake when network may not be ready)
let prisma = null;
let beforeExitHandlerRegistered = false;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Handle connection errors
prisma.$on('query', (e) => {
  console.log('Query: ' + e.query);
  console.log('Duration: ' + e.duration + 'ms');
});

prisma.$on('error', (e) => {
  console.error('Prisma Error:', e);
});

    // Handle process termination (only register once)
    if (!beforeExitHandlerRegistered) {
      beforeExitHandlerRegistered = true;
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
    }
  }
  return prisma;
}

// Export a proxy that creates the client on first property access
// This makes it transparent - code can use it exactly as before
module.exports = new Proxy({}, {
  get(target, prop) {
    const client = getPrisma();
    const value = client[prop];
    // If it's a function, bind it to the client so 'this' works correctly
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
}); 