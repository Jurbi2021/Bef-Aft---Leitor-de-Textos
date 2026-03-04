import {
  ReactCompareSlider,
  ReactCompareSliderHandle,
} from 'react-compare-slider'
import { ScrollArea } from '@/components/ui/ScrollArea'

interface SliderComparisonProps {
  contentBefore: string
  contentAfter: string
}

function TextPanel({ content, label }: { content: string; label: string }) {
  return (
    <div className="h-full w-full bg-background flex flex-col">
      <div className="flex items-center justify-center border-b border-border/60 py-2 shrink-0">
        <span className="rounded-full bg-muted px-4 py-1 text-xs font-semibold text-muted-foreground tracking-wide uppercase">
          {label}
        </span>
      </div>
      <ScrollArea className="flex-1 p-5">
        {content ? (
          <div
            className="prose prose-sm max-w-none text-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: content }}
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
