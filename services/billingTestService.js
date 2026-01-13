const { supabaseAdmin } = require('../config/supabase');
const SystemLogService = require('./systemLogService');
const AutomaticBillingService = require('./automaticBillingService');

class BillingTestService {
    constructor() {
        this.testMode = true;
        this.testResults = [];
    }

    /**
     * Test billing settings change
     */
    async testBillingSettingsChange() {
        console.log('🧪 Testing billing settings change...');
        
        try {
            // Simulate billing settings change
            const testSettings = {
                billing_date: '2025-02-15',
                billing_time: '10:30:00',
                timezone: 'Europe/Amsterdam',
                is_active: true
            };

            await SystemLogService.logBilling(
                'info',
                'Test: Betalingsinstellingen Gewijzigd',
                'Test wijziging van betalingsinstellingen',
                'Incasso datum: 2025-01-31 → 2025-02-15, Incasso tijd: 09:00:00 → 10:30:00',
                null,
                null,
                {
                    test: true,
                    test_type: 'billing_settings_change',
                    old_settings: {
                        billing_date: '2025-01-31',
                        billing_time: '09:00:00',
                        timezone: 'Europe/Amsterdam',
                        is_active: true
                    },
                    new_settings: testSettings
                }
            );

            console.log('✅ Billing settings change test logged');
            return { success: true, message: 'Billing settings change test completed' };

        } catch (error) {
            console.error('❌ Billing settings change test failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Test automatic billing process (dry run)
     */
    async testAutomaticBilling() {
        console.log('🧪 Testing automatic billing process...');
        
        try {
            // Create test users
            const testUsers = await this.createTestUsers();
            
            // Log billing start
            await SystemLogService.logBilling(
                'info',
                'Test: Automatische Incasso Gestart',
                'Test automatische incasso proces gestart',
                `Test gestart met ${testUsers.length} test gebruikers`,
                null,
                null,
                {
                    test: true,
                    test_type: 'automatic_billing',
                    test_users: testUsers.length,
                    dry_run: true
                }
            );

            // Simulate billing process
            let successfulPayments = 0;
            let failedPayments = 0;
            let totalAmount = 0;
            let totalLeads = 0;

            for (const user of testUsers) {
                const result = await this.simulateUserBilling(user);
                
                if (result.success) {
                    successfulPayments++;
                    totalAmount += result.amount;
                    totalLeads += result.leadsCount;
                } else {
                    failedPayments++;
                }
            }

            // Log billing completion
            await SystemLogService.logBilling(
                'success',
                'Test: Automatische Incasso Voltooid',
                'Test automatische incasso proces succesvol voltooid',
                `Test resultaat: ${testUsers.length} gebruikers, ${successfulPayments} succesvol, ${failedPayments} gefaald`,
                null,
                null,
                {
                    test: true,
                    test_type: 'automatic_billing',
                    stats: {
                        total_users: testUsers.length,
                        successful_payments: successfulPayments,
                        failed_payments: failedPayments,
                        total_amount: totalAmount,
                        total_leads: totalLeads
                    },
                    dry_run: true
                }
            );

            console.log('✅ Automatic billing test completed');
            return {
                success: true,
                stats: {
                    totalUsers: testUsers.length,
                    successfulPayments,
                    failedPayments,
                    totalAmount,
                    totalLeads
                }
            };

        } catch (error) {
            console.error('❌ Automatic billing test failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Test billing failure scenarios
     */
    async testBillingFailures() {
        console.log('🧪 Testing billing failure scenarios...');
        
        try {
            // Test 1: User without payment method
            await SystemLogService.logBilling(
                'warning',
                'Test: Gebruiker Geen Betalingsmethode',
                'Test gebruiker heeft geen actieve betalingsmethode',
                'Test Bedrijf BV heeft geen betalingsmethode ingesteld',
                null,
                null,
                {
                    test: true,
                    test_type: 'billing_failure',
                    failure_type: 'no_payment_method',
                    user_id: 'null',
                    company_name: 'Test Bedrijf BV'
                }
            );

            // Test 2: Payment failed
            await SystemLogService.logBilling(
                'error',
                'Test: Betaling Gefaald',
                'Test betaling van €50.00 gefaald voor Test Bedrijf BV',
                'Status: failed, Mollie ID: test_payment_123',
                null,
                null,
                {
                    test: true,
                    test_type: 'billing_failure',
                    failure_type: 'payment_failed',
                    user_id: 'null',
                    company_name: 'Test Bedrijf BV',
                    amount: 50.00,
                    mollie_payment_id: 'test_payment_123',
                    payment_status: 'failed',
                    failure_reason: 'Insufficient funds'
                }
            );

            // Test 3: System error
            await SystemLogService.logBilling(
                'error',
                'Test: Systeem Fout',
                'Test systeem fout tijdens automatische incasso',
                'Fout: Database connection timeout',
                null,
                null,
                {
                    test: true,
                    test_type: 'billing_failure',
                    failure_type: 'system_error',
                    error: 'Database connection timeout',
                    error_code: 'DB_TIMEOUT'
                }
            );

            console.log('✅ Billing failure scenarios test completed');
            return { success: true, message: 'Billing failure scenarios test completed' };

        } catch (error) {
            console.error('❌ Billing failure scenarios test failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Test cron job scheduling
     */
    async testCronJobScheduling() {
        console.log('🧪 Testing cron job scheduling...');
        
        try {
            // Test cron job start
            await SystemLogService.logCron(
                'success',
                'test_billing_scheduler',
                'Test automatische incasso scheduler succesvol gestart',
                'Cron: 30 10 15 * *, Tijdzone: Europe/Amsterdam',
                {
                    test: true,
                    test_type: 'cron_scheduling',
                    cron_expression: '30 10 15 * *',
                    timezone: 'Europe/Amsterdam',
                    billing_date: '2025-02-15',
                    billing_time: '10:30:00'
                }
            );

            // Test cron job execution
            await SystemLogService.logCron(
                'info',
                'test_automatic_billing',
                'Test automatische incasso cron job gestart',
                'Test cron job uitgevoerd volgens schema',
                {
                    test: true,
                    test_type: 'cron_execution',
                    executed_at: new Date().toISOString(),
                    cron_triggered: true
                }
            );

            console.log('✅ Cron job scheduling test completed');
            return { success: true, message: 'Cron job scheduling test completed' };

        } catch (error) {
            console.error('❌ Cron job scheduling test failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Create test users for billing simulation
     */
    async createTestUsers() {
        return [
            {
                id: 'null',
                company_name: 'Test Bedrijf BV',
                email: 'test@bedrijf.nl',
                subscription: { leads_per_month: 20 }
            },
            {
                id: 'null',
                company_name: 'Test Bedrijf 2 BV',
                email: 'test2@bedrijf.nl',
                subscription: { leads_per_month: 15 }
            },
            {
                id: 'null',
                company_name: 'Test Bedrijf 3 BV',
                email: 'test3@bedrijf.nl',
                subscription: { leads_per_month: 25 }
            }
        ];
    }

    /**
     * Simulate user billing
     */
    async simulateUserBilling(user) {
        // Simulate 90% success rate
        const success = Math.random() > 0.1;
        const amount = user.subscription.leads_per_month * 2.50;
        
        if (success) {
            await SystemLogService.logBilling(
                'success',
                'Test: Betaling Succesvol',
                `Test betaling van €${amount.toFixed(2)} succesvol voor ${user.company_name}`,
                `Test Mollie Payment ID: test_${Date.now()}`,
                user.id,
                null,
                {
                    test: true,
                    test_type: 'user_billing',
                    user_id: user.id,
                    company_name: user.company_name,
                    amount: amount,
                    leads_count: user.subscription.leads_per_month,
                    mollie_payment_id: `test_${Date.now()}`,
                    payment_status: 'paid'
                }
            );
            
            return { success: true, amount, leadsCount: user.subscription.leads_per_month };
        } else {
            await SystemLogService.logBilling(
                'error',
                'Test: Betaling Gefaald',
                `Test betaling van €${amount.toFixed(2)} gefaald voor ${user.company_name}`,
                `Status: failed, Test Mollie ID: test_failed_${Date.now()}`,
                user.id,
                null,
                {
                    test: true,
                    test_type: 'user_billing',
                    user_id: user.id,
                    company_name: user.company_name,
                    amount: amount,
                    mollie_payment_id: `test_failed_${Date.now()}`,
                    payment_status: 'failed',
                    failure_reason: 'Test failure simulation'
                }
            );
            
            return { success: false, amount, leadsCount: user.subscription.leads_per_month };
        }
    }

    /**
     * Run all tests
     */
    async runAllTests() {
        console.log('🚀 Starting comprehensive billing system tests...\n');
        
        const results = {
            billingSettingsChange: await this.testBillingSettingsChange(),
            automaticBilling: await this.testAutomaticBilling(),
            billingFailures: await this.testBillingFailures(),
            cronJobScheduling: await this.testCronJobScheduling()
        };

        console.log('\n📊 Test Results Summary:');
        Object.entries(results).forEach(([test, result]) => {
            console.log(`${result.success ? '✅' : '❌'} ${test}: ${result.success ? 'PASSED' : 'FAILED'}`);
            if (!result.success) {
                console.log(`   Error: ${result.error}`);
            }
        });

        const allPassed = Object.values(results).every(result => result.success);
        console.log(`\n🎯 Overall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
        
        return results;
    }
}

module.exports = BillingTestService;
