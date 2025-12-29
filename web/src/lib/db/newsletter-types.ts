// Newsletter types for BestBlogs.dev

export type SubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed';
export type Frequency = 'daily' | 'weekly' | 'biweekly';
export type NewsletterLanguage = 'en' | 'zh';
export type NewsletterCategory =
  | 'Artificial_Intelligence'
  | 'Business_Tech'
  | 'Programming_Technology'
  | 'Product_Development';
export type NewsletterStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
export type SendStatus = 'pending' | 'sent' | 'failed' | 'bounced';
export type EmailStatus = 'pending' | 'processing' | 'sent' | 'failed';

export type SubscriberPreferences = {
  categories: NewsletterCategory[];
  frequency: Frequency;
  language: NewsletterLanguage;
};

export type Subscriber = {
  id: string;
  email: string;
  confirmed: boolean;
  confirmationToken: string | null;
  unsubscribeToken: string | null;
  preferences: SubscriberPreferences;
  subscribedAt: number;
  confirmedAt: number | null;
  unsubscribedAt: number | null;
  lastSentAt: number | null;
  sendCount: number;
  createdAt: number;
  updatedAt: number;
};

export type SubscriberInput = {
  email: string;
  preferences?: Partial<SubscriberPreferences>;
};

export type SubscriberUpdateInput = {
  preferences?: Partial<SubscriberPreferences>;
};

export type NewsletterEdition = {
  id: string;
  title: string;
  subject: string;
  previewText: string | null;
  contentHtml: string;
  contentText: string;
  articleIds: string[];
  categories: NewsletterCategory[];
  language: NewsletterLanguage;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  status: NewsletterStatus;
  scheduledFor: number | null;
  sentAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type NewsletterEditionInput = {
  title: string;
  subject?: string;
  previewText?: string;
  articleIds: string[];
  categories?: NewsletterCategory[];
  language?: NewsletterLanguage;
  scheduledFor?: number | null;
};

export type NewsletterSend = {
  id: string;
  editionId: string;
  subscriberId: string;
  status: SendStatus;
  sentAt: number | null;
  openedAt: number | null;
  clickCount: number;
  errorMessage: string | null;
  createdAt: number;
};

export type NewsletterClick = {
  id: string;
  sendId: string;
  url: string;
  articleId: string | null;
  clickedAt: number;
};

export type QueuedEmail = {
  id: string;
  toEmail: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  fromEmail: string;
  fromName: string;
  category: string | null;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: EmailStatus;
  errorMessage: string | null;
  scheduledFor: number;
  sentAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type EmailQueueInput = {
  toEmail: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  fromEmail?: string;
  fromName?: string;
  category?: string;
  priority?: number;
  scheduledFor?: number;
};

// Statistics types
export type NewsletterStats = {
  totalSubscribers: number;
  confirmedSubscribers: number;
  pendingSubscribers: number;
  unsubscribedSubscribers: number;
  totalEditions: number;
  sentEditions: number;
  totalEmailsSent: number;
  totalOpens: number;
  totalClicks: number;
  averageOpenRate: number;
  averageClickRate: number;
};

export type SubscriberStats = {
  subscriberId: string;
  emailsReceived: number;
  emailsOpened: number;
  clicksTracked: number;
  lastEmailAt: number | null;
  lastOpenAt: number | null;
};
