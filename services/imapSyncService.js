const Imap = require('imap');
const { simpleParser } = require('mailparser');
const AiMailService = require('./aiMailService');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client for the sync service (lazy initialization)
// CRITICAL: Never create clients at top level - always use lazy initialization
// to prevent server startup crashes if env vars aren't loaded yet
let supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for IMAP sync service');
    }
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseAdmin;
}

class ImapSyncService {
  /**
   * Sync emails from a mailbox using IMAP
   * @param {Object} mailbox - Mailbox configuration from database
   * @param {Object} options - Sync options (limit, since, etc.)
   * @returns {Promise<Object>} - Sync results with counts
   */
  static async syncMailbox(mailbox, options = {}) {
    const {
      limit = 50, // Default to 50 emails per sync
      since = null, // Date to sync from (null = all emails)
      folder = 'INBOX' // IMAP folder to sync from
    } = options;

    // Start IMAP sync logs verwijderd voor schonere terminal output

    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: mailbox.imap_username || mailbox.username, // Use imap_username if available
        password: mailbox.imap_password_hash || mailbox.password_hash, // Use imap_password_hash if available
        host: mailbox.imap_host,
        port: mailbox.imap_port,
        tls: mailbox.imap_secure,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 30000,
        authTimeout: 30000
      });

      let syncedCount = 0;
      let errorCount = 0;
      const errors = [];

      imap.once('ready', () => {
        // IMAP verbonden log verwijderd voor schonere terminal output
        
        imap.openBox(folder, false, (err, box) => {
          if (err) {
            console.error(`❌ Kon mailbox folder niet openen: ${err.message}`);
            imap.end();
            return reject(new Error(`Kon mailbox folder niet openen: ${err.message}`));
          }

          // Folder geopend log verwijderd voor schonere terminal output

          // Build search criteria
          // Use ALL to fetch all emails - we'll filter by date after fetching
          // node-imap library has issues with SINCE date format, so post-filtering is more reliable
          let searchCriteria = ['ALL'];
          let filterSinceDate = null;
          
          if (since) {
            if (typeof since === 'string') {
              filterSinceDate = new Date(since);
            } else if (since instanceof Date) {
              filterSinceDate = since;
            } else {
              filterSinceDate = new Date(since);
            }
            
            if (isNaN(filterSinceDate.getTime())) {
              filterSinceDate = null;
            }
          }

          // Search for emails
          imap.search(searchCriteria, (err, results) => {
            if (err) {
              console.error(`❌ Zoeken naar emails mislukt: ${err.message}`);
              imap.end();
              return reject(new Error(`Zoeken naar emails mislukt: ${err.message}`));
            }

            // Gevonden emails log verwijderd voor schonere terminal output

            if (!results || results.length === 0) {
              imap.end();
              // Geen emails gevonden log verwijderd voor schonere terminal output
              return resolve({
                success: true,
                synced: 0,
                skipped: 0,
                errors: 0,
                found: 0
              });
            }

            // Limit the number of emails to fetch
            const uidsToFetch = results.slice(-limit); // Get latest N emails
            // Ophalen emails log verwijderd voor schonere terminal output

            // Fetch emails - get full email body
            const fetch = imap.fetch(uidsToFetch, {
              bodies: '',
              struct: true
            });

            const emailsToProcess = [];
            const emailPromises = [];

            fetch.on('message', (msg, seqno) => {
              let emailBuffer = Buffer.alloc(0);
              let emailData = {
                uid: null,
                from: { name: '', email: '' },
                to: { email: '' },
                subject: '',
                date: null,
                body_text: '',
                body_html: '',
                headers: {},
                messageId: null
              };
              
              let uid = null;

              msg.once('attributes', (attrs) => {
                uid = attrs.uid;
                emailData.uid = uid;
              });

              msg.on('body', (stream, info) => {
                // Handle body stream
                stream.on('data', (chunk) => {
                  emailBuffer = Buffer.concat([emailBuffer, chunk]);
                });

                stream.once('end', () => {
                  // Process email when stream ends
                  if (emailBuffer.length === 0) {
                    console.warn(`⚠️ Lege email buffer voor seqno ${seqno}, uid ${uid}`);
                    return;
                  }

                  // Parse email with mailparser
                  const parsePromise = new Promise((resolve) => {
                    simpleParser(emailBuffer, (err, parsed) => {
                      if (err) {
                        console.error(`❌ Parse error voor email ${seqno} (uid ${uid}):`, err.message);
                        errorCount++;
                        errors.push(`Parse error voor email ${seqno}: ${err.message}`);
                        return resolve(null);
                      }

                      try {
                        // Extract from info
                        let fromName = '';
                        let fromEmail = '';
                        
                        if (parsed.from) {
                          if (Array.isArray(parsed.from.value) && parsed.from.value.length > 0) {
                            fromName = parsed.from.value[0].name || '';
                            fromEmail = parsed.from.value[0].address || '';
                          } else if (typeof parsed.from.text === 'string') {
                            const match = parsed.from.text.match(/^(.+?)\s*<(.+?)>$/);
                            if (match) {
                              fromName = match[1].trim().replace(/['"]/g, '');
                              fromEmail = match[2].trim();
                            } else {
                              fromEmail = parsed.from.text.trim();
                            }
                          }
                        }

                        if (!fromEmail && parsed.from) {
                          fromEmail = parsed.from.address || (typeof parsed.from.text === 'string' ? parsed.from.text : '') || '';
                        }

                        // Extract to info (recipient)
                        let toEmail = mailbox.email; // Default to mailbox email - this should never be null
                        if (parsed.to) {
                          if (Array.isArray(parsed.to.value) && parsed.to.value.length > 0) {
                            toEmail = parsed.to.value[0].address || mailbox.email;
                          } else if (typeof parsed.to.text === 'string') {
                            const toMatch = parsed.to.text.match(/<(.+?)>/);
                            if (toMatch) {
                              toEmail = toMatch[1].trim();
                            } else {
                              toEmail = parsed.to.text.trim() || mailbox.email;
                            }
                          }
                        }
                        
                        // Ensure toEmail is never null or empty
                        if (!toEmail || toEmail.trim() === '') {
                          toEmail = mailbox.email;
                        }

                        emailData.uid = uid || seqno;
                        emailData.from = {
                          name: fromName || (fromEmail ? fromEmail.split('@')[0] : 'Unknown'),
                          email: fromEmail || 'unknown@unknown.com'
                        };
                        emailData.to = {
                          email: toEmail.trim() || mailbox.email
                        };
                        emailData.subject = parsed.subject || '(geen onderwerp)';
                        emailData.date = parsed.date ? new Date(parsed.date) : new Date();
                        emailData.body_text = parsed.text || '';
                        emailData.body_html = parsed.html || '';
                        emailData.headers = parsed.headers || {};
                        emailData.messageId = parsed.messageId || null;

                        // Email geparsed log verwijderd voor schonere terminal output
                        resolve(emailData);
                      } catch (parseErr) {
                        console.error(`❌ Data parsing error voor email ${seqno}:`, parseErr);
                        errorCount++;
                        errors.push(`Data parsing error: ${parseErr.message}`);
                        resolve(null);
                      }
                    });
                  });
                  
                  emailPromises.push(parsePromise);
                });
              });
            });

            fetch.once('end', async () => {
              // Wait for all email parsing to complete
              // Wachten op parsing log verwijderd voor schonere terminal output
              let parsedEmails = await Promise.all(emailPromises);
              
              // Filter out null results (errors)
              parsedEmails = parsedEmails.filter(e => e !== null);
              
              // Apply date filter if specified (post-fetch filtering)
              if (filterSinceDate) {
                const beforeFilter = parsedEmails.length;
                parsedEmails = parsedEmails.filter(e => {
                  if (!e || !e.date) return false;
                  const emailDate = new Date(e.date);
                  return emailDate >= filterSinceDate;
                });
                // Datumfilter log verwijderd voor schonere terminal output
              }
              
              emailsToProcess.push(...parsedEmails);
              
              imap.end();
              
              // Klaar met ophalen log verwijderd voor schonere terminal output

              // Process and save emails
              try {
                // Opslaan emails log verwijderd voor schonere terminal output
                for (const emailData of emailsToProcess) {
                  try {
                    // Extract message ID - prefer direct from mailparser, fallback to headers
                    let messageId = emailData.messageId;
                    
                    if (!messageId && emailData.headers) {
                      // Try different ways to get message-id from headers
                      if (emailData.headers.get && typeof emailData.headers.get === 'function') {
                        messageId = emailData.headers.get('message-id');
                      } else if (emailData.headers['message-id']) {
                        messageId = Array.isArray(emailData.headers['message-id']) 
                          ? emailData.headers['message-id'][0] 
                          : emailData.headers['message-id'];
                      }
                    }
                    
                    // Clean up message ID (remove angle brackets if present)
                    if (messageId && typeof messageId === 'string') {
                      messageId = messageId.replace(/[<>]/g, '').trim();
                    }
                    
                    // Check if email already exists (by message-id, or by from+subject+date combo)
                    let existingMail = null;
                    if (messageId) {
                      const { data } = await getSupabaseAdmin()
                        .from('mail_inbox')
                        .select('id')
                        .eq('message_id', messageId)
                        .maybeSingle();
                      existingMail = data;
                    }
                    
                    // Also check by unique combo if no message-id
                    if (!existingMail) {
                      const { data } = await getSupabaseAdmin()
                        .from('mail_inbox')
                        .select('id')
                        .eq('mailbox_id', mailbox.id)
                        .eq('from_email', emailData.from.email)
                        .eq('subject', emailData.subject)
                        .eq('received_at', emailData.date ? new Date(emailData.date).toISOString() : new Date().toISOString())
                        .maybeSingle();
                      existingMail = data;
                    }

                    if (existingMail) {
                      // Email already exists, skip
                      continue;
                    }

                    // Prepare mail data - ensure mailbox_id is always set
                    if (!mailbox || !mailbox.id) {
                      console.error(`❌ Cannot save email: mailbox.id is missing!`)
                      errorCount++;
                      errors.push(`Mailbox ID missing for email: ${emailData.subject}`);
                      continue;
                    }

                    const mailData = {
                      mailbox_id: mailbox.id,
                      message_id: messageId || null,
                      from_email: emailData.from.email,
                      from_name: emailData.from.name || emailData.from.email.split('@')[0],
                      to_email: emailData.to?.email || mailbox.email, // Use mailbox email as fallback
                      subject: emailData.subject,
                      body_text: emailData.body_text || '',
                      body_html: emailData.body_html || '',
                      received_at: emailData.date ? new Date(emailData.date).toISOString() : new Date().toISOString(),
                      status: 'new', // Allowed values: 'new', 'read', 'replied', 'archived', 'deleted'
                      created_at: new Date().toISOString()
                    };

                    // Validate mailbox_id is set
                    if (!mailData.mailbox_id) {
                      console.error(`❌ Cannot save email "${emailData.subject}": mailbox_id is NULL after preparation!`)
                      errorCount++;
                      errors.push(`Mailbox ID validation failed for: ${emailData.subject}`);
                      continue;
                    }

                    // Insert mail into database
                    const { data: insertedMail, error: insertError } = await getSupabaseAdmin()
                      .from('mail_inbox')
                      .insert(mailData)
                      .select()
                      .single();

                    if (insertError) {
                      errorCount++;
                      errors.push(`Database error voor ${emailData.subject}: ${insertError.message}`);
                      console.error(`❌ Fout bij opslaan email "${emailData.subject}":`, insertError.message);
                      continue;
                    }
                    
                    // Email opgeslagen log verwijderd voor schonere terminal output

                            // Apply AI labeling
                            try {
                              const labelResult = await AiMailService.labelMail({
                                subject: emailData.subject,
                                body: emailData.body_text,
                                from: emailData.from.email
                              });

                      if (labelResult && labelResult.labels && labelResult.labels.length > 0) {
                        const labelsToInsert = labelResult.labels.map(label => ({
                          mail_id: insertedMail.id,
                          label: label,
                          confidence: labelResult.confidence || 0.8,
                          created_at: new Date().toISOString()
                        }));

                        await getSupabaseAdmin()
                          .from('mail_labels')
                          .insert(labelsToInsert);

                        // Auto-link customer by domain/email
                        let customerId = null;
                        try {
                          // First, try to find customer via email_customer_mappings (exact email)
                          const { data: emailMapping } = await getSupabaseAdmin()
                            .from('email_customer_mappings')
                            .select('customer_id')
                            .eq('mapping_type', 'email')
                            .eq('email_or_domain', emailData.from.email.toLowerCase())
                            .eq('confirmed', true)
                            .maybeSingle();

                          if (emailMapping) {
                            customerId = emailMapping.customer_id;
                          } else {
                            // Try domain mapping
                            const emailDomain = emailData.from.email.split('@')[1]?.toLowerCase();
                            if (emailDomain) {
                              const { data: domainMapping } = await getSupabaseAdmin()
                                .from('email_customer_mappings')
                                .select('customer_id')
                                .eq('mapping_type', 'domain')
                                .eq('email_or_domain', emailDomain)
                                .eq('confirmed', true)
                                .maybeSingle();

                              if (domainMapping) {
                                customerId = domainMapping.customer_id;
                              } else {
                                // Try to find customer by domain field in customers table
                                const { data: domainCustomer } = await getSupabaseAdmin()
                                  .rpc('find_customer_by_domain', {
                                    p_email: emailData.from.email
                                  });

                                if (domainCustomer) {
                                  customerId = domainCustomer;
                                }
                              }
                            }
                          }

                          // If customer found, update mail
                          if (customerId) {
                            await getSupabaseAdmin()
                              .from('mail_inbox')
                              .update({
                                auto_linked_customer_id: customerId,
                                updated_at: new Date().toISOString()
                              })
                              .eq('id', insertedMail.id);
                          }
                        } catch (linkError) {
                          console.error('Customer linking error:', linkError);
                          // Don't fail if linking fails
                        }

                        // Analyze ticket needs
                        try {
                          const mailForAnalysis = {
                            subject: emailData.subject,
                            body_text: emailData.body_text,
                            from_email: emailData.from.email,
                            labels: labelResult.labels
                          };

                          let ticketAnalysis;
                          
                          // Try AI analysis first if available
                          if (AiMailService.isOpenAIAvailable()) {
                            try {
                              const openai = AiMailService.getOpenAIClient();
                              ticketAnalysis = await AiMailService.analyzeTicketWithOpenAI(openai, {
                                subject: emailData.subject,
                                body: emailData.body_text,
                                from: emailData.from.email,
                                labels: labelResult.labels
                              });
                            } catch (aiError) {
                              console.error('AI ticket analysis error:', aiError);
                              // Fallback to keyword-based
                              ticketAnalysis = AiMailService.analyzeTicketNeeds(mailForAnalysis);
                            }
                          } else {
                            // Use keyword-based analysis
                            ticketAnalysis = AiMailService.analyzeTicketNeeds(mailForAnalysis);
                          }

                          // Update mail with ticket analysis
                          if (ticketAnalysis && ticketAnalysis.shouldCreateTicket) {
                            await getSupabaseAdmin()
                              .from('mail_inbox')
                              .update({
                                should_create_ticket: true,
                                suggested_ticket_priority: ticketAnalysis.priority,
                                updated_at: new Date().toISOString()
                              })
                              .eq('id', insertedMail.id);

                            // Auto-create ticket with assignment if it's a customer request
                            if (labelResult.labels.includes('customer_request') || labelResult.labels.includes('support') || labelResult.labels.includes('ticket')) {
                              try {
                                const TicketAssignmentService = require('./ticketAssignmentService');
                                
                                // Auto-assign based on skills
                                const assignmentInfo = await TicketAssignmentService.autoAssignTicketFromMail({
                                  subject: emailData.subject,
                                  body_text: emailData.body_text,
                                  from_email: emailData.from.email,
                                  from_name: emailData.from.name
                                }, {
                                  priority: ticketAnalysis.priority
                                });
                                
                                // Use the customerId from earlier linking (already set in customerId variable above)
                                
                                // Generate AI summary for ticket description
                                const AiMailService = require('./aiMailService');
                                let ticketDescription = '';
                                try {
                                  const mailForSummary = {
                                    subject: emailData.subject,
                                    body_text: emailData.body_text,
                                    from_email: emailData.from.email,
                                    from_name: emailData.from.name
                                  };
                                  ticketDescription = await AiMailService.generateSupportSummary(mailForSummary);
                                } catch (summaryError) {
                                  console.error('Error generating summary during sync, using fallback:', summaryError);
                                  // Fallback to original format
                                  ticketDescription = `Ticket automatisch aangemaakt van e-mail:\n\nVan: ${emailData.from.name || emailData.from.email}\nE-mail: ${emailData.from.email}\nOnderwerp: ${emailData.subject || 'Geen onderwerp'}\n\n${emailData.body_text || ''}`;
                                }
                                
                                // Create ticket
                                const ticketSubject = emailData.subject || 'Geen onderwerp';
                                
                                const { data: ticket, error: ticketError } = await getSupabaseAdmin()
                                  .from('tickets')
                                  .insert({
                                    subject: ticketSubject,
                                    description: ticketDescription,
                                    customer_id: customerId || null,
                                    mail_id: insertedMail.id,
                                    priority: ticketAnalysis.priority || 'normal',
                                    category: 'support',
                                    source: 'email',
                                    requester_email: emailData.from.email,
                                    requester_name: emailData.from.name,
                                    assignee_id: assignmentInfo?.assignee_id || null,
                                    status: 'open'
                                  })
                                  .select()
                                  .single();
                                
                                if (!ticketError && ticket) {
                                  // Update mail to link it to the ticket
                                  await getSupabaseAdmin()
                                    .from('mail_inbox')
                                    .update({
                                      ticket_id: ticket.id,
                                      ticket_created_at: new Date().toISOString(),
                                      customer_id: customerId || undefined
                                    })
                                    .eq('id', insertedMail.id);
                                  
                                  const assigneeName = assignmentInfo?.assignee_name || 'niet toegewezen';
                                  console.log(`✅ Auto-created and assigned ticket ${ticket.id} to ${assigneeName} (priority: ${ticketAnalysis.priority})`);
                                } else if (ticketError) {
                                  console.error('Error auto-creating ticket:', ticketError);
                                }
                              } catch (autoTicketError) {
                                console.error('Error in auto-ticket creation:', autoTicketError);
                                // Don't fail the sync if auto-ticket creation fails
                              }
                            }
                          }
                        } catch (ticketError) {
                          console.error('Ticket analysis error:', ticketError);
                          // Don't fail if ticket analysis fails
                        }
                      }
                    } catch (labelError) {
                      console.error('AI labeling error:', labelError);
                      // Don't fail the sync if labeling fails
                    }

                    syncedCount++;
                  } catch (emailError) {
                    errorCount++;
                    errors.push(`Verwerken email mislukt: ${emailError.message}`);
                  }
                }

                // Sync voltooid log verwijderd voor schonere terminal output
                
                resolve({
                  success: true,
                  synced: syncedCount,
                  skipped: emailsToProcess.length - syncedCount - errorCount,
                  errors: errorCount,
                  errorMessages: errors,
                  found: emailsToProcess.length
                });
              } catch (processError) {
                reject(new Error(`Verwerken emails mislukt: ${processError.message}`));
              }
            });

            fetch.once('error', (err) => {
              imap.end();
              reject(new Error(`Ophalen emails mislukt: ${err.message}`));
            });
          });
        });
      });

      imap.once('error', (err) => {
        console.error(`❌ IMAP verbindingsfout: ${err.message}`);
        console.error('Details:', err);
        imap.end();
        reject(new Error(`IMAP verbindingsfout: ${err.message}`));
      });

      imap.once('end', () => {
        // Connection closed
      });

      // Connect to IMAP server
      imap.connect();
    });
  }

  /**
   * Sync emails from a mailbox (from database ID)
   * @param {string} mailboxId - Mailbox ID from database
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} - Sync results
   */
  static async syncMailboxById(mailboxId, options = {}) {
    // Fetch mailbox from database
    const { data: mailbox, error } = await getSupabaseAdmin()
      .from('mailboxes')
      .select('*')
      .eq('id', mailboxId)
      .single();

    if (error || !mailbox) {
      throw new Error('Mailbox niet gevonden');
    }

    return await this.syncMailbox(mailbox, options);
  }
}

module.exports = ImapSyncService;

