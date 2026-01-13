const { supabaseAdmin } = require('./config/supabase');
const SystemLogService = require('./services/systemLogService');

async function createDutchLogs() {
  console.log('🇳🇱 Creating Dutch system logs...\n');

  try {
    // Test 1: Nederlandse systeem log
    console.log('📝 Test 1: Nederlandse systeem log...');
    await SystemLogService.logSystem(
      'info',
      'Systeem Test',
      'Testen van Nederlandse systeem logging functionaliteit',
      'Dit is een Nederlandse test log entry',
      { test: true, taal: 'nederlands', stap: 1 }
    );

    // Test 2: Nederlandse billing log
    console.log('💰 Test 2: Nederlandse billing log...');
    await SystemLogService.logBilling(
      'info',
      'Betalingsinstellingen Test',
      'Testen van Nederlandse betalingsinstellingen logging',
      'Betalingsinstellingen bijgewerkt voor test',
      null,
      null,
      { 
        test: true, 
        taal: 'nederlands',
        stap: 2,
        oude_datum: '2025-01-31',
        nieuwe_datum: '2025-02-15'
      }
    );

    // Test 3: Nederlandse authenticatie log
    console.log('🔐 Test 3: Nederlandse authenticatie log...');
    await SystemLogService.logAuth(
      null,
      'ingelogd',
      'Test gebruiker login voor systeem test',
      '127.0.0.1',
      'Test User Agent'
    );

    // Test 4: Nederlandse admin log
    console.log('👨‍💼 Test 4: Nederlandse admin log...');
    await SystemLogService.logAdmin(
      'testte systeemlogs',
      'Admin voerde systeemlogs test uit',
      null,
      null,
      { test: true, taal: 'nederlands', stap: 4 }
    );

    // Test 5: Nederlandse betaling log
    console.log('💳 Test 5: Nederlandse betaling log...');
    await SystemLogService.logPayment(
      'success',
      'Test Betaling',
      'Testen van Nederlandse betaling logging functionaliteit',
      'Betaling succesvol verwerkt voor test',
      null,
      { 
        test: true, 
        taal: 'nederlands',
        stap: 5,
        bedrag: 29.99,
        valuta: 'EUR'
      }
    );

    // Test 6: Nederlandse cron log
    console.log('⏰ Test 6: Nederlandse cron log...');
    await SystemLogService.logCron(
      'success',
      'test_cron_job',
      'Testen van Nederlandse cron job logging',
      'Cron job succesvol uitgevoerd',
      { test: true, taal: 'nederlands', stap: 6, duur: '2.5s' }
    );

    // Test 7: Nederlandse API log
    console.log('🌐 Test 7: Nederlandse API log...');
    await SystemLogService.logAPI(
      'info',
      '/api/test',
      'Testen van Nederlandse API logging functionaliteit',
      'API endpoint succesvol aangeroepen',
      null,
      '127.0.0.1',
      'Test API Client'
    );

    // Test 8: Nederlandse error log
    console.log('❌ Test 8: Nederlandse error log...');
    await SystemLogService.logSystem(
      'error',
      'Test Fout',
      'Testen van Nederlandse error logging functionaliteit',
      'Dit is een Nederlandse test fout voor systeem validatie',
      { test: true, taal: 'nederlands', stap: 8, fout_code: 'TEST_FOUT' }
    );

    // Test 9: Nederlandse critical log
    console.log('🚨 Test 9: Nederlandse critical log...');
    await SystemLogService.log({
      type: 'critical',
      category: 'system',
      title: 'Test Kritieke Gebeurtenis',
      message: 'Testen van Nederlandse kritieke gebeurtenis logging',
      details: 'Dit is een Nederlandse test kritieke gebeurtenis',
      source: 'Systeem Test',
      metadata: { test: true, taal: 'nederlands', stap: 9, kritiek: true },
      severity: 'critical'
    });

    // Test 10: Nederlandse automatische incasso log
    console.log('🔄 Test 10: Nederlandse automatische incasso log...');
    await SystemLogService.logBilling(
      'success',
      'Automatische Incasso Gestart',
      'Automatische incasso proces gestart',
      'Alle actieve gebruikers worden verwerkt voor maandelijkse incasso',
      null,
      null,
      { 
        test: true, 
        taal: 'nederlands',
        stap: 10,
        gebruikers_verwerkt: 25,
        totaal_bedrag: 750.00
      }
    );

    console.log('\n🎉 Alle Nederlandse logs succesvol aangemaakt!');
    console.log('\n📋 Ga naar admin panel → Instellingen → Systeemlogs om ze te bekijken');

  } catch (error) {
    console.error('💥 Fout bij aanmaken Nederlandse logs:', error);
    process.exit(1);
  }
}

createDutchLogs();
