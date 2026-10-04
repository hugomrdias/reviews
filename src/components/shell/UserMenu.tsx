import { LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { avatarSrc } from '@/components/comments/ThreadCard'
import { useTheme, type Theme } from '@/lib/theme'
import type { SessionUser } from '@/server/auth/session'

export function UserMenu({ viewer, align = 'end' }: { viewer: SessionUser; align?: 'start' | 'end' }) {
  const { theme, setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-2 px-1.5" aria-label="Account and appearance">
          <Avatar className="size-6">
            {viewer.avatarUrl && <AvatarImage src={avatarSrc(viewer.avatarUrl, 48)} alt="" />}
            <AvatarFallback className="text-[10px]">{viewer.login.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium">{viewer.login}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{viewer.name ?? viewer.login}</span>
          <span className="block text-xs text-muted-foreground">Signed in with GitHub</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          <DropdownMenuRadioItem value="light">
            <Sun /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> Match system
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <form method="post" action="/auth/logout">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
