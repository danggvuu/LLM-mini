import { Children, isValidElement, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState('');
  const copiedTimerRef = useRef(null);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeText = String(children).replace(/\n$/, '');

  useEffect(() => {
    setCopied(false);
    setCopyError('');
    return () => clearTimeout(copiedTimerRef.current);
  }, [codeText]);

  const handleCopy = async () => {
    if (copying) return;
    setCopying(true);
    setCopied(false);
    setCopyError('');
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Không sao chép được. Hãy chọn và chép mã trực tiếp.');
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0d0e12] font-mono text-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-white/[0.04] border-b border-white/10 text-gray-400 text-[11px]">
        <span className="font-semibold uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          type="button"
          disabled={copying}
          className="flex items-center gap-1 hover:text-white transition px-2 py-0.5 rounded hover:bg-white/10"
          title="Sao chép mã"
        >
          {copied ? (
            <>
              <Check size={12} className="text-green-400" />
              <span className="text-green-400">Đã chép</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>
      {copyError && <p role="alert" className="px-3.5 pt-2 text-xs text-red-300">{copyError}</p>}
      <pre className="p-3.5 overflow-x-auto text-gray-200 leading-relaxed">
        <code>{codeText}</code>
      </pre>
    </div>
  );
}

export default function MarkdownRenderer({ content, isDark = true }) {
  if (typeof content !== 'string' || !content) return null;

  return (
    <div className={`markdown-content text-sm leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            const code = Children.toArray(children).find(isValidElement);
            return <CodeBlock className={code?.props.className}>{code?.props.children ?? children}</CodeBlock>;
          },
          code({ children }) {
            return (
              <code 
                className={`px-1.5 py-0.5 rounded text-[12px] font-mono font-medium ${
                  isDark ? 'bg-white/10 text-pink-300' : 'bg-gray-200 text-purple-700'
                }`} 
              >
                {children}
              </code>
            );
          },
          h1: ({ children }) => (
            <h1 className="text-xl font-bold mt-4 mb-2 pb-1 border-b border-white/10">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold mt-3 mb-1.5 text-blue-400">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-2.5 mb-1 text-purple-400">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="my-1.5 leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside my-2 space-y-1 pl-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside my-2 space-y-1 pl-2">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-purple-500/80 pl-3 my-2 italic text-gray-400 bg-white/[0.02] py-1 rounded-r">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-white/15 scrollbar-hide">
              <table className="w-full text-xs text-left border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className={`font-semibold border-b ${isDark ? 'bg-white/10 text-white border-white/15' : 'bg-gray-100 text-gray-900 border-gray-200'}`}>{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 border-r border-white/10 last:border-r-0">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-white/10 border-r last:border-r-0">{children}</td>
          ),
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition"
            >
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
