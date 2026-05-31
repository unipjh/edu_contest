import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App.jsx'
import LoadingSpinner from './components/common/LoadingSpinner.jsx'
import './styles.css'

const LibraryPage = lazy(() => import('./pages/LibraryPage.jsx'))
const ViewerPage = lazy(() => import('./pages/ViewerPage.jsx'))
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<main className="mainArea"><LoadingSpinner label="화면을 준비하고 있습니다." /></main>}>
        <Routes>
          <Route element={<App />}>
            <Route index element={<Navigate to="/library" replace />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/viewer/:docId" element={<ViewerPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
)
