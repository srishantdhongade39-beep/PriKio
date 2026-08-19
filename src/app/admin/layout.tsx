import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { LayoutDashboard, Users, Settings, LogOut } from 'lucide-react'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    redirect('/')
  }

  const isSuperAdmin = profile.role === 'super_admin'

  return (
    <div className="flex min-h-screen bg-[#F5F5F7] font-sans text-[#1d1d1f] selection:bg-blue-100">
      {/* Sidebar */}
      <aside className="w-[260px] bg-white flex-col hidden md:flex z-20 shadow-[1px_0_0_0_rgba(0,0,0,0.04)]">
        <div className="h-[88px] flex items-center px-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="text-[17px] font-semibold tracking-[-0.02em]">CampusPrint</span>
          </div>
        </div>
        
        <div className="px-4 py-2">
          <nav className="space-y-1">
            <Link 
              href="/admin/dashboard" 
              className="flex items-center px-4 py-3 text-[15px] font-medium rounded-xl text-blue-600 bg-blue-50/60 transition-all duration-200"
            >
              <LayoutDashboard className="mr-3 h-[18px] w-[18px]" strokeWidth={2.5} />
              Overview
            </Link>
            
            {isSuperAdmin && (
              <Link 
                href="/admin/team" 
                className="flex items-center px-4 py-3 text-[15px] font-medium rounded-xl text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#F5F5F7] transition-all duration-200"
              >
                <Users className="mr-3 h-[18px] w-[18px]" strokeWidth={2} />
                Team
              </Link>
            )}
          </nav>
        </div>

        <div className="mt-auto p-4 mb-4">
          <div className="px-4 py-4 mb-2 flex items-center gap-3 rounded-xl hover:bg-[#F5F5F7] transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border border-black/5 shadow-sm">
              <span className="text-gray-600 text-sm font-semibold">{profile.role === 'super_admin' ? 'S' : 'A'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-medium text-[#1d1d1f] tracking-tight">{profile.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
              <span className="text-[13px] text-[#86868b]">Authenticated</span>
            </div>
          </div>
          
          <Link 
            href="/" 
            className="flex items-center px-4 py-3 text-[15px] font-medium rounded-xl text-[#86868b] hover:text-red-500 hover:bg-red-50 transition-all duration-200"
          >
            <LogOut className="mr-3 h-[18px] w-[18px]" strokeWidth={2} />
            Sign Out
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 lg:p-14 max-w-[1200px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
