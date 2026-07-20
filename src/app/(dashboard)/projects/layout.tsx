'use client'
import { usePathname } from 'next/navigation'
import ProjectsLifecycleShell, { showProjectsLifecycleShell } from './ProjectsLifecycleShell'

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || ''

  if (!showProjectsLifecycleShell(pathname)) {
    return <>{children}</>
  }

  return (
    <ProjectsLifecycleShell>
      {children}
    </ProjectsLifecycleShell>
  )
}
