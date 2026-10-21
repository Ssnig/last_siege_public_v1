import React, { useEffect, useRef, useState } from 'react';
import { authApi } from './api';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      theme?: string;
      size?: string;
      width?: number;
      text?: string;
      shape?: string;
      logo_alignment?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    const script = existing ?? document.createElement('script');

    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Failed to load Google Identity Services.')),
      { once: true },
    );

    if (!existing) {
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    googleScriptPromise = null;
    throw error;
  });

  return googleScriptPromise;
}

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  disabled?: boolean;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onCredential,
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const credentialHandlerRef = useRef(onCredential);
  const [clientId, setClientId] = useState<string | null | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    credentialHandlerRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;

    authApi
      .googleConfig()
      .then(({ clientId: configuredId }) => {
        if (!cancelled) setClientId(configuredId);
      })
      .catch(() => {
        if (!cancelled) setClientId(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        const googleId = window.google?.accounts?.id;
        const container = containerRef.current;
        if (cancelled || !googleId || !container) return;

        googleId.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              credentialHandlerRef.current(response.credential);
            }
          },
        });

        container.innerHTML = '';
        googleId.renderButton(container, {
          theme: 'filled_black',
          size: 'large',
          width: Math.min(320, container.clientWidth || 320),
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (clientId === null || unavailable) {
    return (
      <p
        className="text-center text-[11px] text-amber-200/50 italic"
        style={{ fontFamily: "'Almendra', 'Georgia', serif" }}
      >
        Google sign-in is not available right now.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-10 flex items-center justify-center transition-opacity ${
        disabled ? 'opacity-50 pointer-events-none' : ''
      }`}
    >
      {clientId === undefined && (
        <span className="text-[11px] text-amber-200/50">Loading Google sign-in...</span>
      )}
    </div>
  );
};
