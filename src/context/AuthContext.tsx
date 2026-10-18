'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  full_name: string | null
  student_id: string | null
  department: string | null
  year: number | null
  wallet_balance: number
  role: string
}

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchSessionAndProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setUser(session.user)
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          if (profileData) {
            setProfile(profileData as Profile)
          } else {
            setProfile({
              id: session.user.id,
              full_name: session.user.email?.split('@')[0] || 'Student',
              student_id: 'PU' + Math.floor(100000 + Math.random() * 900000),
              department: 'Information Technology',
              year: 2,
              wallet_balance: 150,
              role: 'student'
            })
          }
        } else {
          setUser(null)
          setProfile(null)
        }
      } catch (err) {
        console.error('Error fetching session:', err)
        setUser(null)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    fetchSessionAndProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setUser(session.user)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
        
        if (profileData) {
          setProfile(profileData as Profile)
        } else {
          setProfile({
            id: session.user.id,
            full_name: session.user.email?.split('@')[0] || 'Student',
            student_id: 'PU' + Math.floor(100000 + Math.random() * 900000),
            department: 'Information Technology',
            year: 2,
            wallet_balance: 150,
            role: 'student'
          })
        }
      } else {
        setUser(null)
        setProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signIn = async () => {
    // handled via sign in form
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useContext(AuthContext)
}
