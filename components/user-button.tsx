"use client"

import { useUser, useClerk } from "@clerk/nextjs"
import { LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function UserButton() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()

  if (!isLoaded || !user) return null

  const initials = user.firstName ? user.firstName.charAt(0).toUpperCase() : "U"
  const firstName = user.firstName || "Account"
  const email = user.primaryEmailAddress?.emailAddress

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="h-8 w-8 overflow-hidden rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Avatar className="h-full w-full">
            <AvatarImage src={user.imageUrl} alt={firstName} />
            <AvatarFallback className="bg-muted text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-56 rounded-none border-input p-0 shadow-sm"
        align="end"
        sideOffset={8}
      >
        <div className="flex flex-col space-y-1 p-3">
          <p className="text-sm leading-none font-medium text-foreground">
            {firstName}
          </p>
          {email && (
            <p className="truncate pt-1 text-xs leading-none text-muted-foreground">
              {email}
            </p>
          )}
        </div>

        <DropdownMenuSeparator className="m-0 bg-input" />

        <div className="p-1">
          <DropdownMenuItem
            onClick={() => signOut()}
            className="cursor-pointer rounded-none text-muted-foreground hover:text-foreground focus:bg-accent focus:text-foreground"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
