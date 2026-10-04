import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { disconnectAgent } from '@/functions/agents'
import { connectedAgentsQuery } from '@/lib/queries'
import { absoluteTime, relativeTime } from '@/lib/time'

/** The agents someone connected, a way to cut one off, and how to connect one. */
export function ConnectedAgentsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const { data, isError } = useQuery({ ...connectedAgentsQuery(), enabled: open })
  const disconnect = useMutation({
    mutationFn: (grantId: string) => disconnectAgent({ data: { grantId } }),
    onSuccess: () => toast.success('Agent disconnected'),
    onError: () => toast.error('Couldn’t disconnect the agent. Try again.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: connectedAgentsQuery().queryKey }),
  })
  const command = data ? `claude mcp add --transport http reviews ${data.mcpUrl}` : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connected agents</DialogTitle>
          <DialogDescription>
            Agents act as you, with your GitHub access: they read comments, reply, and mark threads addressed for you
            to confirm.
          </DialogDescription>
        </DialogHeader>

        {isError ? (
          <p className="text-sm text-muted-foreground">Couldn’t load your agents. Close this and try again.</p>
        ) : !data ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : data.agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agents connected yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.agents.map((agent) => (
              <li key={agent.grantId} className="flex items-center gap-3 rounded-lg border p-3">
                <Bot className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Connected <time title={absoluteTime(agent.connectedAt)}>{relativeTime(agent.connectedAt)}</time>
                    {!agent.canWrite && ' · read only'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disconnect.isPending && disconnect.variables === agent.grantId}
                  onClick={() => disconnect.mutate(agent.grantId)}
                >
                  Disconnect
                </Button>
              </li>
            ))}
          </ul>
        )}

        {command && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-muted-foreground">To connect Claude Code, run this in your repository:</p>
            <div className="flex items-start gap-2 rounded-lg bg-muted p-2">
              <code className="min-w-0 flex-1 font-mono text-xs break-all">{command}</code>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                aria-label="Copy the command"
                onClick={() => void navigator.clipboard.writeText(command).then(() => toast.success('Command copied'))}
              >
                <Copy />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
