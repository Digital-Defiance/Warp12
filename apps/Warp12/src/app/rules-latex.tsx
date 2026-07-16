import { SciContent } from 'latex-content-renderer';
import { useMemo } from 'react';

import styles from './rules-view.module.scss';

interface RulesLatexProps {
  source: string;
}

export function RulesLatex({ source }: RulesLatexProps) {
  const processedSource = useMemo(() => {
    // Strip document preamble and keep only body content
    const bodyMatch = source.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    return bodyMatch ? bodyMatch[1] : source;
  }, [source]);

  return (
    <article className={styles.markdown}>
      {/* latex-content-renderer@1.1.3 exposes no link-customization hooks, so
          internal doc cross-links render as plain anchors from the processed
          HTML. Reintroduce a LinkComponent here if the library gains one. */}
      <SciContent content={processedSource} className={styles.latexContent} />
    </article>
  );
}
