/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router-dom"
import { BottomNav } from "@/src/components/layout/BottomNav"
import { Home } from "@/src/pages/Home"
import { Scan } from "@/src/pages/Scan"
import { Result } from "@/src/pages/Result"
import { Settings } from "@/src/pages/Settings"
import { History } from "@/src/pages/History"
import { Pricing } from "@/src/pages/Pricing"
import { FAQ } from "@/src/pages/FAQ"
import { Login } from "@/src/pages/Login"
import { Signup } from "@/src/pages/Signup"
import { AuthProvider, useAuth } from "@/src/lib/AuthContext"

function Layout() {
  const { user, isLoading } = useAuth()
  
  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-md bg-bg-canvas min-h-screen shadow-2xl relative overflow-hidden">
        <main className="flex-1 pb-20">
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md bg-bg-canvas min-h-screen shadow-2xl relative overflow-hidden">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

function FullScreenLayout() {
  return (
    <div className="mx-auto max-w-md bg-bg-canvas min-h-screen shadow-2xl relative overflow-hidden">
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route element={<FullScreenLayout />}>
            <Route path="/scan" element={<Scan />} />
            <Route path="/result" element={<Result />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}
