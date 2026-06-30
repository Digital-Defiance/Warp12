import type { Components } from 'react-markdown';
import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import styles from './rules-view.module.scss';

interface RulesMarkdownProps {
  source: string;
}

const INTERNAL_DOC_ROUTES: Record<string, string> = {
  './calibration-log.md': '/paper/log',
  'calibration-log.md': '/paper/log',
  './tei-paper-outline.md': '/paper',
  'tei-paper-outline.md': '/paper',
};

function resolveMarkdownHref(href: string | undefined): string | null {
  if (!href) {
    return null;
  }
  return INTERNAL_DOC_ROUTES[href] ?? null;
}

export function RulesMarkdown({ source }: RulesMarkdownProps) {
  const components = useMemo<Components>(
    () => ({
      h1: ({ children }) => <h1 className={styles.h1}>{children}</h1>,
      h2: ({ children }) => <h2 className={styles.h2}>{children}</h2>,
      h3: ({ children }) => <h3 className={styles.h3}>{children}</h3>,
      h4: ({ children }) => <h4 className={styles.h4}>{children}</h4>,
      p: ({ children }) => <p className={styles.p}>{children}</p>,
      hr: () => <hr className={styles.hr} />,
      ul: ({ children }) => <ul className={styles.ul}>{children}</ul>,
      ol: ({ children }) => <ol className={styles.ol}>{children}</ol>,
      li: ({ children }) => <li>{children}</li>,
      blockquote: ({ children }) => (
        <blockquote className={styles.blockquote}>{children}</blockquote>
      ),
      table: ({ children }) => (
        <div className={styles.tableWrap}>
          <table className={styles.table}>{children}</table>
        </div>
      ),
      thead: ({ children }) => <thead>{children}</thead>,
      tbody: ({ children }) => <tbody>{children}</tbody>,
      tr: ({ children }) => <tr>{children}</tr>,
      th: ({ children }) => <th>{children}</th>,
      td: ({ children }) => <td>{children}</td>,
      strong: ({ children }) => <strong>{children}</strong>,
      em: ({ children }) => <em>{children}</em>,
      pre: ({ children }) => <pre className={styles.pre}>{children}</pre>,
      code: ({ className, children }) => {
        const isBlock = Boolean(className?.startsWith('language-'));
        if (isBlock) {
          return <code className={styles.codeBlock}>{children}</code>;
        }
        return <code className={styles.inlineCode}>{children}</code>;
      },
      a: ({ href, children }) => {
        const internal = resolveMarkdownHref(href);
        if (internal) {
          return (
            <Link to={internal} className={styles.link}>
              {children}
            </Link>
          );
        }
        if (href?.startsWith('/')) {
          return (
            <Link to={href} className={styles.link}>
              {children}
            </Link>
          );
        }
        return (
          <a
            href={href}
            className={styles.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        );
      },
    }),
    []
  );

  return (
    <article className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </article>
  );
}
