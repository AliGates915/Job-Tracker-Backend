import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Verify environment variables
if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
  console.error('❌ EMAIL_USER or EMAIL_APP_PASSWORD not set in environment variables');
  process.exit(1);
}

console.log(`📧 Email service configured for: ${process.env.EMAIL_USER}`);

// Create transporter with better configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
  debug: true, // Enable debug output
  logger: true, // Log info to console
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter verification failed:', error);
  } else {
    console.log('✅ Email transporter is ready to send emails');
  }
});

// Email templates (keep your existing templates)
export const sendReminderEmail = async (to, reminder) => {
  console.log(`📧 Preparing to send email to: ${to}`);
  
  const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Job Application Reminder</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 20px auto;
          padding: 20px;
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 2px solid #f0f0f0;
        }
        .header h1 {
          color: #2563eb;
          margin: 0;
          font-size: 24px;
        }
        .content {
          padding: 20px 0;
        }
        .reminder-card {
          background-color: #f8fafc;
          border-left: 4px solid #2563eb;
          padding: 15px;
          margin: 20px 0;
          border-radius: 8px;
        }
        .reminder-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 10px;
        }
        .reminder-detail {
          margin: 8px 0;
          color: #475569;
        }
        .reminder-label {
          font-weight: 600;
          color: #334155;
        }
        .footer {
          text-align: center;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #94a3b8;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background-color: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin-top: 15px;
        }
        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }
        .badge-interview { background-color: #dbeafe; color: #1e40af; }
        .badge-follow-up { background-color: #dcfce7; color: #166534; }
        .badge-deadline { background-color: #fee2e2; color: #991b1b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Job Tracker Reminder</h1>
        </div>
        <div class="content">
          <p>Hello ${reminder.userId?.fullName || 'there'},</p>
          <p>This is a reminder for your upcoming job application event:</p>
          
          <div class="reminder-card">
            <div class="reminder-title">${reminder.title}</div>
            <div class="reminder-detail">
              <span class="reminder-label">📝 Description:</span> ${reminder.description || 'No description provided'}
            </div>
            <div class="reminder-detail">
              <span class="reminder-label">⏰ Date & Time:</span> ${new Date(reminder.reminderDate).toLocaleString()}
            </div>
            <div class="reminder-detail">
              <span class="reminder-label">🏷️ Type:</span>
              <span class="badge badge-${reminder.type}">${reminder.type.toUpperCase()}</span>
            </div>
          </div>
          
        </div>
        <div class="footer">
          <p>This is an automated reminder from Job Tracker App.</p>
          <p>If you no longer wish to receive these reminders, please update your notification settings.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Job Tracker" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: `Reminder: ${reminder.title}`,
    html: emailTemplate,
    // Add text version as fallback
    text: `Reminder: ${reminder.title}\n\n${reminder.description}\nDate: ${new Date(reminder.reminderDate).toLocaleString()}\nType: ${reminder.type}`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent: ', info.messageId, 'to:', to);
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    console.error('❌ Error sending email: ', error);
    return { success: false, error: error.message };
  }
};

export const sendDailyDigest = async (to, reminders) => {
  const remindersList = reminders.map(reminder => `
    <div class="reminder-card">
      <div class="reminder-title">${reminder.title}</div>
      <div class="reminder-detail">
        <span class="reminder-label">⏰ Time:</span> ${new Date(reminder.reminderDate).toLocaleTimeString()}
      </div>
      <div class="reminder-detail">
        <span class="reminder-label">🏷️ Type:</span>
        <span class="badge badge-${reminder.type}">${reminder.type.toUpperCase()}</span>
      </div>
    </div>
  `).join('');

  const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Daily Reminder Digest</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
        }
        .content {
          padding: 30px;
        }
        .reminder-count {
          background-color: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
          margin-bottom: 20px;
        }
        .reminder-count .count {
          font-size: 32px;
          font-weight: bold;
          color: #16a34a;
        }
        .footer {
          background-color: #f8fafc;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📅 Daily Reminder Digest</h1>
        </div>
        <div class="content">
          <div class="reminder-count">
            <div class="count">${reminders.length}</div>
            <div>Reminders for today</div>
          </div>
          
          <h3>Your reminders for today:</h3>
          ${remindersList}
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">
              View All Reminders
            </a>
          </div>
        </div>
        <div class="footer">
          <p>Stay organized with Job Tracker! 🚀</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"Job Tracker" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: `📅 Daily Reminder Digest - ${new Date().toLocaleDateString()}`,
    html: emailTemplate,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending digest: ', error);
    return { success: false, error: error.message };
  }
};

export default transporter;