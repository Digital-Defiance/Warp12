import { SciContent } from 'latex-content-renderer';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import styles from './rules-view.module.scss';

interface RulesLatexProps {
  source: string;
}

const INTERNAL_DOC_ROUTES: Record<string, string> = {
  './calibration-log.md': '/paper/log',
  'calibration-log.md': '/paper/log',
  './tei-paper-outline.md': '/paper',
  'tei-paper-outline.md': '/paper',
};

export function RulesLatex({ source }: RulesLatexProps) {
  const processedSource = useMemo(() => {
    // Strip document preamble and keep only body content
    const bodyMatch = source.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    return bodyMatch ? bodyMatch[1] : source;
  }, [source]);

  return (
    <article className={styles.markdown}>
      <SciContent
        content={processedSource}
        className={styles.latexContent}
        linkResolver={(href) => {
          const internal = INTERNAL_DOC_ROUTES[href];
          if (internal) {
            return internal;
          }
          if (href?.startsWith('/')) {
            return href;
          }
          return href;
        }}
        LinkComponent={({ href, children }) => {
          const internal = INTERNAL_DOC_ROUTES[href || ''];
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
        }}
      />
    </article>
  );
}
