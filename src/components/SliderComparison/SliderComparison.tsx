import {
  ReactCompareSlider,
  ReactCompareSliderHandle,
} from 'react-compare-slider'
import { ScrollArea } from '@/components/ui/ScrollArea'

interface SliderComparisonProps {
  contentBefore: string
  contentAfter: string
}

/** Converte texto puro com \n em HTML com <br /> e escapa caracteres especiais. */
function plainTextToHtml(text: string): string {
  if (!text.trim()) return ''
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return escaped.replace(/\n/g, '<br />')
}

/** Se o conteúdo parecer HTML (contém tags), usa como está; senão trata como texto com quebras de linha. */
function normalizeContentForDisplay(content: string): string {
  if (!content.trim()) return ''
  if (content.trimStart().startsWith('<') && (content.includes('</') || content.includes('/>'))) {
    return content
  }
  return plainTextToHtml(content)
}

function TextPanel({ content, label }: { content: string; label: string }) {
  const html = normalizeContentForDisplay(content)
  return (
    <div className="h-full w-full bg-background flex flex-col">
      <div className="flex items-center justify-center border-b border-border/60 py-2 shrink-0">
        <span className="rounded-full bg-muted px-4 py-1 text-xs font-semibold text-muted-foreground tracking-wide uppercase">
          {label}
        </span>
      </div>
      <ScrollArea className="flex-1 p-5">
        {html ? (
          <div
            className="prose prose-sm max-w-none text-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">Nenhum conteúdo ainda.</p>
        )}
      </ScrollArea>
    </div>
  )
}

export function SliderComparison({ contentBefore, contentAfter }: SliderComparisonProps) {
  return (
    <div className="h-full w-full overflow-hidden rounded-lg border border-border shadow-sm">
      <ReactCompareSlider
        style={{ height: '100%', width: '100%' }}
        handle={
          <ReactCompareSliderHandle
            buttonStyle={{
              backdropFilter: 'none',
              background: 'hsl(262, 80%, 55%)',
              border: '3px solid white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              width: 36,
              height: 36,
            }}
            linesStyle={{
              background: 'hsl(262, 80%, 55%)',
              width: 2,
            }}
          />
        }
        itemOne={<TextPanel content={contentBefore} label="Antes" />}
        itemTwo={<TextPanel content={contentAfter} label="Depois" />}
      />
    </div>
  )
}
