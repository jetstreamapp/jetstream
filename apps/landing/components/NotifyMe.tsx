import React, { useState } from 'react';
import classNames from 'classnames';
import { signUpNotify } from '@jetstream/shared/data';
import { REGEX } from '@jetstream/shared/utils';
import { logger } from '@jetstream/shared/client-logger';
import Link from 'next/link';

type Submission = 'notSubmitted' | 'inProgress' | 'success' | 'error';

export const NotifyMe = () => {
  const [email, setEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>(null);
  const [validEmail, setValidEmail] = useState<boolean>(false);
  const [submission, setSubmission] = useState<Submission>('notSubmitted');

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
    setValidEmail(REGEX.VALID_EMAIL.test(event.target.value));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    try {
      setErrorMessage(null);
      event.preventDefault();
      setSubmission('inProgress');
      await signUpNotify(email);
      setSubmission('success');
    } catch (ex) {
      logger.log(ex);
      setSubmission('error');
      setErrorMessage(ex.message);
    }
  }

  return (
    <div className="mt-5 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0">
      <p className="text-base font-medium text-gray-900">Sign up to get notified when it’s ready.</p>
      <form className="mt-3 sm:flex" onSubmit={handleSubmit}>
        <input
          aria-label="Email"
          className={classNames(
            'appearance-none block w-full px-3 py-3 border border-gray-300 text-base leading-6 rounded-md placeholder-gray-500 shadow-sm focus:outline-none focus:placeholder-gray-400 focus:shadow-outline focus:border-blue-300 transition duration-150 ease-in-out sm:flex-1',
            { 'opacity-75 cursor-not-allowed': submission !== 'notSubmitted' && submission !== 'error' }
          )}
          placeholder="Enter your email"
          value={email}
          onChange={handleChange}
          disabled={submission !== 'notSubmitted' && submission !== 'error'}
        />
        <button
          type="submit"
          value="submit"
          className={classNames(
            'mt-3 w-full px-6 py-3 border border-transparent text-base leading-6 font-medium rounded-md text-white bg-gray-800 shadow-sm hover:bg-gray-700 focus:outline-none focus:shadow-outline active:bg-gray-900 transition duration-150 ease-in-out sm:mt-0 sm:ml-3 sm:flex-shrink-0 sm:inline-flex sm:items-center sm:w-auto',
            { 'opacity-50 cursor-not-allowed': !validEmail }
          )}
          disabled={!validEmail || (submission !== 'notSubmitted' && submission !== 'error')}
        >
          Notify me
        </button>
      </form>
      {errorMessage && <p className="mt-3 text-sm leading-5 text-red-500">{errorMessage}</p>}
      {submission === 'success' && (
        <p className="mt-3 text-sm leading-5 text-green-500">
          We have received your submission and will notify you once we are ready for beta users.
        </p>
      )}
      <p className="mt-3 text-sm leading-5 text-gray-500">
        We care about the protection of your data. Read our{' '}
        <Link href="/privacy">
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a className="font-medium text-gray-900 underline">Privacy Policy</a>
        </Link>
        .
      </p>
    </div>
  );
};

export default NotifyMe;
