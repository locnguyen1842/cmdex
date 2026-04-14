import React, { useState, useEffect, useCallback } from 'react'
import {createRoot} from 'react-dom/client'
import './i18n'
import './style.css'
import App from './App'
import SettingsPage from './components/SettingsPage'
import { GetSettings, SetSettings } from '../bindings/cmdex/app'
import { THEMES, CustomTheme } from './App'
import { EventsEmit } from '../wailsjs/runtime/runtime'

const container = document.getElementById('root')

const isSettingsWindow = new URLSearchParams(window.location.search).get('window') === 'settings'

const root = createRoot(container!)

if (isSettingsWindow) {
    const applyTheme = (themeId: string) => {
        document.documentElement.setAttribute('data-theme', themeId)
    }

    const applyDensity = (density: string) => {
        document.documentElement.setAttribute('data-density', density)
    }

    const applyFonts = (uiFont: string, monoFont: string) => {
        const fontValue = uiFont === 'System Default'
            ? 'system-ui, -apple-system, sans-serif'
            : `'${uiFont}', system-ui, sans-serif`
        document.documentElement.style.setProperty('--font-sans', fontValue)
        document.documentElement.style.setProperty('--font-mono', `'${monoFont}', monospace`)
    }

    function SettingsWindow() {
        const [theme, setTheme] = useState('vscode-dark')
        const [density, setDensity] = useState('comfortable')
        const [uiFont, setUiFont] = useState('Inter')
        const [monoFont, setMonoFont] = useState('JetBrains Mono')
        const [customThemes, setCustomThemes] = useState<CustomTheme[]>([])

        useEffect(() => {
            GetSettings().then(s => {
                if (!s) return
                const t = s.theme || 'vscode-dark'
                setTheme(t)
                setDensity(s.density || 'comfortable')
                setUiFont(s.uiFont || 'Inter')
                setMonoFont(s.monoFont || 'JetBrains Mono')
                applyTheme(t)
                applyDensity(s.density || 'comfortable')
                applyFonts(s.uiFont || 'Inter', s.monoFont || 'JetBrains Mono')
                if (s.customThemes && s.customThemes !== '[]') {
                    try { setCustomThemes(JSON.parse(s.customThemes)) } catch {}
                }
            }).catch(() => {})
        }, [])

        const handleThemeChange = useCallback((newTheme: string) => {
            const builtIn = THEMES.find(t => t.id === newTheme)
            const custom = customThemes.find(t => t.id === newTheme)
            const themeType = builtIn?.type ?? custom?.type ?? 'dark'
            if (themeType === 'dark') {
                document.documentElement.style.setProperty('--cmdex-last-dark-theme', newTheme)
            } else {
                document.documentElement.style.setProperty('--cmdex-last-light-theme', newTheme)
            }
            if (custom) {
                Object.entries(custom.colors).forEach(([key, value]) => {
                    document.documentElement.style.setProperty(`--${key}`, value)
                })
            } else {
                const allVarKeys = [
                    'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
                    'primary', 'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
                    'accent', 'accent-foreground', 'destructive', 'destructive-foreground', 'success', 'success-foreground',
                    'border', 'input', 'ring', 'tab-bar-bg', 'tab-active-bg', 'tab-inactive-bg',
                    'tab-active-indicator', 'status-bar-bg', 'status-bar-fg'
                ]
                allVarKeys.forEach(key => document.documentElement.style.removeProperty(`--${key}`))
            }
            setTheme(newTheme)
        }, [customThemes])

        const handleDensityChange = useCallback((d: string) => {
            setDensity(d)
            applyDensity(d)
        }, [])

        const handleUiFontChange = useCallback((font: string) => {
            setUiFont(font)
            applyFonts(font, monoFont)
        }, [monoFont])

        const handleMonoFontChange = useCallback((font: string) => {
            setMonoFont(font)
            applyFonts(uiFont, font)
        }, [uiFont])

        return (
            <SettingsPage
                theme={theme}
                onThemeChange={handleThemeChange}
                customThemes={customThemes}
                density={density}
                onDensityChange={handleDensityChange}
                uiFont={uiFont}
                monoFont={monoFont}
                onUiFontChange={handleUiFontChange}
                onMonoFontChange={handleMonoFontChange}
                standalone
            />
        )
    }

    root.render(
        <React.StrictMode>
            <SettingsWindow />
        </React.StrictMode>
    )
} else {
    root.render(
        <React.StrictMode>
            <App/>
        </React.StrictMode>
    )
}
