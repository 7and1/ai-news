'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';

interface ManagePreferencesProps {
  token: string;
}

const CATEGORY_OPTIONS = [
  { value: 'Artificial_Intelligence', label: 'Artificial Intelligence' },
  { value: 'Business_Tech', label: 'Business & Technology' },
  { value: 'Programming_Technology', label: 'Programming' },
  { value: 'Product_Development', label: 'Product Development' },
];

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'daily', label: 'Daily' },
];

type FormState = 'idle' | 'loading' | 'saving' | 'success' | 'error';

export function ManagePreferences({ token }: ManagePreferencesProps) {
  const [email, setEmail] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'biweekly'>('weekly');
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const [formState, setFormState] = useState<FormState>('loading');
  const [message, setMessage] = useState('');

  // Load current preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const response = await fetch(`/api/newsletter/preferences?token=${token}`);
        const data = await response.json();

        if (data.success) {
          setEmail(data.email);
          setSelectedCategories(data.preferences.categories || []);
          setFrequency(data.preferences.frequency || 'weekly');
          setLanguage(data.preferences.language || 'en');
          setFormState('idle');
        } else {
          setFormState('error');
          setMessage('Invalid or expired link');
        }
      } catch {
        setFormState('error');
        setMessage('Failed to load preferences');
      }
    };

    void loadPreferences();
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormState('saving');
    setMessage('');

    try {
      const response = await fetch('/api/newsletter/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          preferences: {
            categories: selectedCategories,
            frequency,
            language,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        setFormState('success');
        setMessage('Preferences updated successfully!');
        setTimeout(() => setFormState('idle'), 3000);
      } else {
        setFormState('error');
        setMessage(data.error || 'Failed to update preferences');
      }
    } catch {
      setFormState('error');
      setMessage('Network error. Please try again.');
    }
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  if (formState === 'loading') {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Loading preferences...</p>
        </div>
      </div>
    );
  }

  if (formState === 'error' && message.includes('link')) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
        <h2 className="text-xl font-semibold text-red-900 dark:text-red-400">Invalid Link</h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Newsletter Preferences
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Manage your subscription settings for{' '}
        <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>
      </p>

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="mt-6 space-y-6"
      >
        {/* Categories */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Topics you want to receive
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {CATEGORY_OPTIONS.map((cat) => (
              <label
                key={cat.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  selectedCategories.includes(cat.value)
                    ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800'
                    : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.value)}
                  onChange={() => toggleCategory(cat.value)}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{cat.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            How often do you want to receive emails?
          </label>
          <div className="mt-3 space-y-2">
            {FREQUENCY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  frequency === opt.value
                    ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800'
                    : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                }`}
              >
                <input
                  type="radio"
                  name="frequency"
                  value={opt.value}
                  checked={frequency === opt.value}
                  onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'biweekly')}
                  className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Language preference
          </label>
          <div className="mt-3 flex gap-3">
            {[
              { value: 'en' as const, label: 'English' },
              { value: 'zh' as const, label: 'Chinese' },
            ].map((lang) => (
              <label
                key={lang.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                  language === lang.value
                    ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800'
                    : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                }`}
              >
                <input
                  type="radio"
                  name="language"
                  value={lang.value}
                  checked={language === lang.value}
                  onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
                  className="h-4 w-4 border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-800"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{lang.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Status message */}
        {formState === 'success' && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
            {message}
          </div>
        )}

        {formState === 'error' && !message.includes('link') && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {message}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={formState === 'saving'}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {formState === 'saving' ? 'Saving...' : 'Save Preferences'}
        </button>

        {/* Cancel link */}
        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Return to home
          </Link>
        </div>
      </form>
    </div>
  );
}
