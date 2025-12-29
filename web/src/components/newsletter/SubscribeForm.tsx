'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';

interface SubscribeFormProps {
  className?: string;
  onSuccess?: () => void;
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

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export function SubscribeForm({ className = '', onSuccess }: SubscribeFormProps) {
  const [email, setEmail] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Artificial_Intelligence',
    'Business_Tech',
    'Programming_Technology',
    'Product_Development',
  ]);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'biweekly'>('weekly');
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const [formState, setFormState] = useState<FormState>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormState('submitting');
    setMessage('');

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
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
        setMessage(
          data.confirmed
            ? "You're already subscribed!"
            : 'Please check your email to confirm your subscription.'
        );
        if (onSuccess) {onSuccess();}
      } else {
        setFormState('error');
        setMessage(data.error || 'Subscription failed. Please try again.');
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

  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        Subscribe to our newsletter
      </h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Get the latest AI news and insights delivered to your inbox.
      </p>

      {formState === 'success' ? (
        <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
          <p className="font-medium">Check your inbox!</p>
          <p className="mt-1">{message}</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="mt-4 space-y-4"
        >
          {/* Email input */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-600"
            />
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Topics
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CATEGORY_OPTIONS.map((cat) => (
                <label
                  key={cat.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
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
                  <span className="text-zinc-700 dark:text-zinc-300">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Frequency and Language */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="frequency"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Frequency
              </label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'biweekly')}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="language"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Language
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'zh')}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-500/20 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              >
                <option value="en">English</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
          </div>

          {/* Error message */}
          {formState === 'error' && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
              {message}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={formState === 'submitting' || !email}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {formState === 'submitting' ? 'Subscribing...' : 'Subscribe'}
          </button>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            We respect your privacy. Unsubscribe at any time.
          </p>
        </form>
      )}
    </div>
  );
}
