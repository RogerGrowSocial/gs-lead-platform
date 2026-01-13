'use strict'

const { createClient } = require('@supabase/supabase-js')
const AiMailService = require('./aiMailService')

// Initialize Supabase client
let supabaseAdmin = null
function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
    }
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
  }
  return supabaseAdmin
}

class TicketAssignmentService {
  /**
   * Extract required skills from email content using AI
   * @param {Object} mailContent - Email content with subject, body, etc.
   * @returns {Promise<Array<string>>} - Array of required skills
   */
  static async extractRequiredSkills(mailContent) {
    const subject = mailContent.subject || ''
    const body = (mailContent.body || mailContent.body_text || '').substring(0, 3000)
    
    // Try AI extraction first if available
    if (AiMailService.isOpenAIAvailable()) {
      try {
        const openai = AiMailService.getOpenAIClient()
        const skills = await this.extractSkillsWithOpenAI(openai, subject, body)
        if (skills && skills.length > 0) {
          return skills
        }
      } catch (error) {
        console.error('AI skills extraction error, falling back to keyword-based:', error.message)
      }
    }
    
    // Fallback to keyword-based extraction
    return this.extractSkillsWithKeywords(subject + ' ' + body)
  }

  /**
   * Extract skills using OpenAI
   */
  static async extractSkillsWithOpenAI(openai, subject, body) {
    const prompt = `Analyseer deze e-mail van een klant en identificeer welke vaardigheden/expertise nodig zijn om dit ticket op te lossen.

Mogelijke skills/expertise gebieden:
- Technisch: "Web Development", "WordPress", "SEO", "E-commerce", "Database", "API", "Hosting", "SSL", "Security"
- Marketing: "SEO", "Google Ads", "Social Media", "Content Marketing", "Email Marketing", "Analytics"
- Design: "Web Design", "UI/UX", "Graphic Design", "Branding"
- Support: "Customer Service", "Technical Support", "Billing", "Account Management"
- Sales: "Sales", "Account Management", "Proposals"
- Algemeen: "General Support", "Administration"

E-mail:
Onderwerp: ${subject}
Inhoud: ${body}

Geef een JSON array terug met alleen de relevante skills (bijvoorbeeld: ["Web Development", "WordPress", "Technical Support"]).
Geef ALLEEN de JSON array terug, geen andere tekst.`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Je bent een expert in het analyseren van klantvragen en het identificeren van benodigde vaardigheden. Geef alleen JSON arrays terug, geen andere tekst.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 150
      })

      const responseText = completion.choices[0].message.content.trim()
      
      try {
        const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim()
        const skills = JSON.parse(cleaned)
        
        if (Array.isArray(skills)) {
          return skills.filter(s => typeof s === 'string' && s.trim().length > 0)
        }
      } catch (parseError) {
        // Try to extract skills from text
        const skillKeywords = [
          'Web Development', 'WordPress', 'SEO', 'E-commerce', 'Database', 'API', 'Hosting', 'SSL', 'Security',
          'Google Ads', 'Social Media', 'Content Marketing', 'Email Marketing', 'Analytics',
          'Web Design', 'UI/UX', 'Graphic Design', 'Branding',
          'Customer Service', 'Technical Support', 'Billing', 'Account Management',
          'Sales', 'General Support', 'Administration'
        ]
        
        const foundSkills = skillKeywords.filter(skill => 
          responseText.toLowerCase().includes(skill.toLowerCase())
        )
        
        if (foundSkills.length > 0) {
          return foundSkills
        }
      }
    } catch (error) {
      console.error('OpenAI skills extraction error:', error)
    }
    
    return []
  }

  /**
   * Extract skills using keyword matching
   */
  static extractSkillsWithKeywords(text) {
    const lowerText = text.toLowerCase()
    const skills = []
    
    // Technical skills
    if (lowerText.includes('website') || lowerText.includes('web') || lowerText.includes('site')) {
      skills.push('Web Development')
    }
    if (lowerText.includes('wordpress') || lowerText.includes('wp')) {
      skills.push('WordPress')
    }
    if (lowerText.includes('seo') || lowerText.includes('zoekmachine') || lowerText.includes('ranking')) {
      skills.push('SEO')
    }
    if (lowerText.includes('webshop') || lowerText.includes('e-commerce') || lowerText.includes('winkel')) {
      skills.push('E-commerce')
    }
    if (lowerText.includes('database') || lowerText.includes('data') || lowerText.includes('sql')) {
      skills.push('Database')
    }
    if (lowerText.includes('api') || lowerText.includes('integratie') || lowerText.includes('koppeling')) {
      skills.push('API')
    }
    if (lowerText.includes('hosting') || lowerText.includes('server') || lowerText.includes('domein')) {
      skills.push('Hosting')
    }
    if (lowerText.includes('ssl') || lowerText.includes('certificaat') || lowerText.includes('https')) {
      skills.push('SSL')
    }
    if (lowerText.includes('security') || lowerText.includes('veiligheid') || lowerText.includes('hack')) {
      skills.push('Security')
    }
    
    // Marketing skills
    if (lowerText.includes('google ads') || lowerText.includes('adwords') || lowerText.includes('advertentie')) {
      skills.push('Google Ads')
    }
    if (lowerText.includes('social media') || lowerText.includes('facebook') || lowerText.includes('instagram')) {
      skills.push('Social Media')
    }
    if (lowerText.includes('content') || lowerText.includes('blog') || lowerText.includes('artikel')) {
      skills.push('Content Marketing')
    }
    if (lowerText.includes('email marketing') || lowerText.includes('nieuwsbrief')) {
      skills.push('Email Marketing')
    }
    if (lowerText.includes('analytics') || lowerText.includes('statistieken') || lowerText.includes('tracking')) {
      skills.push('Analytics')
    }
    
    // Design skills
    if (lowerText.includes('design') || lowerText.includes('ontwerp') || lowerText.includes('styling')) {
      skills.push('Web Design')
    }
    if (lowerText.includes('ui') || lowerText.includes('ux') || lowerText.includes('gebruikerservaring')) {
      skills.push('UI/UX')
    }
    if (lowerText.includes('logo') || lowerText.includes('branding') || lowerText.includes('huisstijl')) {
      skills.push('Branding')
    }
    
    // Support skills
    if (lowerText.includes('support') || lowerText.includes('hulp') || lowerText.includes('probleem')) {
      skills.push('Technical Support')
    }
    if (lowerText.includes('billing') || lowerText.includes('factuur') || lowerText.includes('betaling')) {
      skills.push('Billing')
    }
    if (lowerText.includes('account') || lowerText.includes('klant') || lowerText.includes('relatie')) {
      skills.push('Account Management')
    }
    
    // If no specific skills found, add general support
    if (skills.length === 0) {
      skills.push('General Support')
    }
    
    return [...new Set(skills)] // Remove duplicates
  }

  /**
   * Find the best employee for a ticket based on skills and availability
   * @param {Object} ticketData - Ticket data with subject, description, priority, etc.
   * @param {Array<string>} requiredSkills - Required skills extracted from email
   * @returns {Promise<Object|null>} - Best employee match or null
   */
  static async findBestEmployee(ticketData, requiredSkills = []) {
    try {
      // Get all active employees
      // Priority: is_employee flag > check if not a customer (no customer_id in customers table)
      const { data: allProfiles, error: profilesError } = await getSupabaseAdmin()
        .from('profiles')
        .select('id, first_name, last_name, email, skills, is_admin, is_employee, status')
        .eq('status', 'active')
        .order('first_name', { ascending: true })
      
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
        return null
      }
      
      // Filter to get employees only
      // If is_employee flag exists and is true, use that
      // Otherwise, exclude admins and assume they're employees if they have skills or are not customers
      let employees = (allProfiles || []).filter(profile => {
        // If is_employee flag is explicitly set, use it
        if (profile.is_employee !== null && profile.is_employee !== undefined) {
          return profile.is_employee === true
        }
        // Otherwise, exclude pure admins (but allow employees who might be admins)
        // In practice, we'll include anyone who is active and not a pure admin
        return !profile.is_admin || profile.skills?.length > 0
      })
      
      // If no employees found with is_employee flag, fallback to all non-admin active profiles
      if (employees.length === 0) {
        employees = (allProfiles || []).filter(p => p.status === 'active' && !p.is_admin)
      }
      
      if (employees.length === 0) {
        console.warn('No employees found for ticket assignment')
        return null
      }
      
      // Get current ticket assignments to check workload
      const { data: currentTickets } = await getSupabaseAdmin()
        .from('tickets')
        .select('assignee_id, status')
        .in('status', ['new', 'open', 'waiting_on_customer', 'waiting_on_internal'])
      
      // Count open tickets per employee
      const ticketCounts = {}
      if (currentTickets) {
        currentTickets.forEach(ticket => {
          if (ticket.assignee_id) {
            ticketCounts[ticket.assignee_id] = (ticketCounts[ticket.assignee_id] || 0) + 1
          }
        })
      }
      
      // Score each employee
      const scores = employees.map(emp => {
        let score = 0
        const empSkills = (emp.skills || []).map(s => s.toLowerCase())
        const requiredSkillsLower = requiredSkills.map(s => s.toLowerCase())
        
        // Skill matching (0-50 points)
        if (requiredSkills.length > 0) {
          const matchingSkills = requiredSkillsLower.filter(reqSkill => 
            empSkills.some(empSkill => 
              empSkill.includes(reqSkill) || reqSkill.includes(empSkill)
            )
          )
          const skillMatchRatio = matchingSkills.length / requiredSkills.length
          score += skillMatchRatio * 50
        } else {
          // No specific skills required, give base score
          score += 25
        }
        
        // Availability/workload (0-30 points)
        const openTicketCount = ticketCounts[emp.id] || 0
        // Less tickets = higher score (max 30 points for 0 tickets, 0 points for 10+ tickets)
        const availabilityScore = Math.max(0, 30 - (openTicketCount * 3))
        score += availabilityScore
        
        // Experience bonus (0-20 points)
        // If employee has many skills, they're likely experienced
        if (empSkills.length > 0) {
          const experienceBonus = Math.min(20, empSkills.length * 2)
          score += experienceBonus
        } else {
          // New employee, give small bonus
          score += 5
        }
        
        return {
          employee_id: emp.id,
          employee_name: [emp.first_name, emp.last_name].filter(Boolean).join(' ') || 'Onbekend',
          employee_email: emp.email,
          score: Math.round(score),
          matching_skills: requiredSkills.length > 0 
            ? requiredSkillsLower.filter(reqSkill => 
                empSkills.some(empSkill => 
                  empSkill.includes(reqSkill) || reqSkill.includes(empSkill)
                )
              )
            : [],
          open_tickets: openTicketCount
        }
      })
      
      // Sort by score (highest first)
      scores.sort((a, b) => b.score - a.score)
      
      // Always return the best match (even if score is low, someone needs to handle it)
      // This ensures tickets are always assigned to someone
      const bestMatch = scores[0]
      
      if (bestMatch) {
        return {
          assignee_id: bestMatch.employee_id,
          assignee_name: bestMatch.employee_name,
          assignee_email: bestMatch.employee_email,
          score: bestMatch.score,
          matching_skills: bestMatch.matching_skills,
          open_tickets: bestMatch.open_tickets,
          reason: bestMatch.matching_skills.length > 0
            ? `Beste match op basis van skills: ${bestMatch.matching_skills.join(', ')} (${bestMatch.open_tickets} open tickets)`
            : `Toegewezen op basis van beschikbaarheid (${bestMatch.open_tickets} open tickets)`
        }
      }
      
      // Fallback: if no scores (shouldn't happen), return first employee
      if (employees.length > 0) {
        const firstEmp = employees[0]
        return {
          assignee_id: firstEmp.id,
          assignee_name: [firstEmp.first_name, firstEmp.last_name].filter(Boolean).join(' ') || 'Onbekend',
          assignee_email: firstEmp.email,
          score: 0,
          matching_skills: [],
          open_tickets: ticketCounts[firstEmp.id] || 0,
          reason: 'Fallback: eerste beschikbare medewerker'
        }
      }
      
      // If no employees at all, return null (caller should handle)
      return null
    } catch (error) {
      console.error('Error finding best employee:', error)
      return null
    }
  }

  /**
   * Auto-assign ticket based on email content
   * @param {Object} mailData - Mail data with subject, body_text, etc.
   * @param {Object} ticketData - Ticket data (optional, for additional context)
   * @returns {Promise<Object|null>} - Assignment result or null
   */
  static async autoAssignTicketFromMail(mailData, ticketData = {}) {
    try {
      // Extract required skills from email
      const requiredSkills = await this.extractRequiredSkills({
        subject: mailData.subject || ticketData.subject || '',
        body: mailData.body_text || ticketData.description || ''
      })
      
      console.log(`📋 Extracted required skills: ${requiredSkills.join(', ')}`)
      
      // Find best employee
      const assignment = await this.findBestEmployee(
        {
          subject: mailData.subject || ticketData.subject || '',
          description: mailData.body_text || ticketData.description || '',
          priority: ticketData.priority || 'normal'
        },
        requiredSkills
      )
      
      if (assignment) {
        console.log(`✅ Auto-assigned ticket to ${assignment.assignee_name} (score: ${assignment.score}, skills: ${assignment.matching_skills.join(', ') || 'none'})`)
        return assignment
      }
      
      console.warn('⚠️ Could not auto-assign ticket - no suitable employee found')
      return null
    } catch (error) {
      console.error('Error in auto-assign ticket from mail:', error)
      return null
    }
  }
}

module.exports = TicketAssignmentService
