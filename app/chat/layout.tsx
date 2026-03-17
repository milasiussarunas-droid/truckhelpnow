import { buildMetadata } from '@/lib/seo'

export const metadata = buildMetadata({
  title: 'Truck Diagnostic Chat for SPN/FMI Codes and Warning Lights',
  description:
    'Start a TruckHelpNow diagnostic session to describe symptoms, paste SPN/FMI fault codes, or upload dashboard photos for structured, safety-first truck troubleshooting guidance.',
  path: '/chat',
  keywords: [
    'truck diagnostic chat',
    'SPN FMI assistant',
    'semi truck fault code tool',
    'truck warning light analysis',
  ],
})

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
