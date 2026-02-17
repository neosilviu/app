import { safeEnv } from '../utils/env';

export const INTEGRATION = {
  whatsapp: {
    enabled: true,
    provider: 'twilio',
    accountSidEnvVar: 'TWILIO_ACCOUNT_SID',
    authTokenEnvVar: 'TWILIO_AUTH_TOKEN',
    phoneNumberEnvVar: 'TWILIO_PHONE_NUMBER',
    webhookSecret: safeEnv('WHATSAPP_WEBHOOK_SECRET', 'your-webhook-secret'),
    messageTimeout: 30000,
    maxRetries: 3,
  },
  gmail: {
    enabled: true,
    clientIdEnvVar: 'GMAIL_CLIENT_ID',
    clientSecretEnvVar: 'GMAIL_CLIENT_SECRET',
    refreshTokenEnvVar: 'GMAIL_REFRESH_TOKEN',
    maxEmailsPerSync: 50,
    syncInterval: 3600,
  },
  slack: {
    enabled: false,
    botTokenEnvVar: 'SLACK_BOT_TOKEN',
    signingSecretEnvVar: 'SLACK_SIGNING_SECRET',
  },
} as const;

export const EMAIL_TEMPLATE = {
  workspace_invitation: {
    subject: {
      ro: "Invitație Workspace - {{workspaceName}}",
      en: "Workspace Invitation - {{workspaceName}}"
    },
    body: {
      ro: "Bună ziua,\n\nAți fost invitat să vă alăturați workspace-ului \"{{workspaceName}}\" pe platforma Studio App cu rolul de {{roleLabel}}.\n\nPuteți accesa platforma aici: {{appUrl}}\n\nEchipa Studio App",
      en: "Hello,\n\nYou have been invited to join the workspace \"{{workspaceName}}\" on the Studio App platform with the role of {{roleLabel}}.\n\nYou can access the platform here: {{appUrl}}\n\nThe Studio App Team"
    },
    html: {
      ro: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4f46e5;">Invitație Workspace Nou</h2>
          <p>Bună ziua,</p>
          <p>Ați fost invitat să vă alăturați workspace-ului <strong>{{workspaceName}}</strong> cu rolul de <strong>{{roleLabel}}</strong>.</p>
          <div style="margin: 30px 0;">
            <a href="{{appUrl}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Accesează Studio App</a>
          </div>
          <p style="color: #666; font-size: 12px;">Dacă nu recunoașteți această invitație, vă rugăm să ignorați acest email.</p>
        </div>
      `,
      en: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4f46e5;">New Workspace Invitation</h2>
          <p>Hello,</p>
          <p>You have been invited to join the workspace <strong>{{workspaceName}}</strong> with the role of <strong>{{roleLabel}}</strong>.</p>
          <div style="margin: 30px 0;">
            <a href="{{appUrl}}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Access Studio App</a>
          </div>
          <p style="color: #666; font-size: 12px;">If you do not recognize this invitation, please ignore this email.</p>
        </div>
      `
    }
  }
} as const;
