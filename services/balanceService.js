const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class BalanceService {
  /**
   * Get user's current balance
   * @param {string} userId 
   * @returns {Promise<number>} Current balance
   */
  async getUserBalance(userId) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('balance')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return profile.balance || 0;
    } catch (error) {
      logger.error('Error getting user balance:', error);
      throw new Error('Kon saldo niet ophalen');
    }
  }

  /**
   * Check if user has sufficient balance
   * @param {string} userId 
   * @param {number} amount 
   * @returns {Promise<boolean>}
   */
  async hasSufficientBalance(userId, amount) {
    const balance = await this.getUserBalance(userId);
    return balance >= amount;
  }

  /**
   * Pay invoice with balance
   * @param {string} userId 
   * @param {string} invoiceId 
   * @param {number} amount 
   * @returns {Promise<Object>} Transaction details
   */
  async payWithBalance(userId, invoiceId, amount) {
    try {
      // Start a transaction
      const { data: transaction, error: transactionError } = await supabase.rpc('pay_with_balance', {
        p_user_id: userId,
        p_invoice_id: invoiceId,
        p_amount: amount
      });

      if (transactionError) throw transactionError;

      // Log successful payment
      logger.info('Balance payment successful', {
        userId,
        invoiceId,
        amount,
        transactionId: transaction.id
      });

      return transaction;
    } catch (error) {
      logger.error('Error processing balance payment:', error);
      throw new Error('Kon betaling niet verwerken: ' + error.message);
    }
  }

  /**
   * Get user's balance transaction history
   * @param {string} userId 
   * @param {Object} options Query options (limit, offset, etc)
   * @returns {Promise<Array>} Transaction history
   */
  async getTransactionHistory(userId, options = {}) {
    try {
      const { limit = 10, offset = 0 } = options;
      
      const { data: transactions, error } = await supabase
        .from('balance_transactions')
        .select(`
          *,
          invoices (
            invoice_number,
            description
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return transactions;
    } catch (error) {
      logger.error('Error getting transaction history:', error);
      throw new Error('Kon transactiegeschiedenis niet ophalen');
    }
  }
}

module.exports = new BalanceService(); 