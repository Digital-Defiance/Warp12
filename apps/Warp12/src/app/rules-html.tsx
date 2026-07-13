import { useMemo } from 'react';
import styles from './rules-view.module.scss';

interface RulesHtmlProps {
  source: string;
}

export function RulesHtml({ source }: RulesHtmlProps) {
  const processedHtml = useMemo(() => {
    // Extract just the body content from the pandoc-generated HTML
    const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : source;
  }, [source]);

  return (
    <article 
      className={styles.markdown}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  );
}
