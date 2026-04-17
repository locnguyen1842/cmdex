import React, { useState, useEffect, useCallback, useRef } from 'react'
import {createRoot} from 'react-dom/client'
import './i18n'
import './style.css'
import App from './App'
import SettingsPage from './components/SettingsPage'
import { GetSettings, SetSettings } from '../bindings/cmdex/settingsservice'
import { THEMES, CustomTheme } from './App'
import { Events } from '@wailsio/runtime'
import { eventNames } from './wails/events'
import { toast } from 'sonner'

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
        const [locale, setLocale] = useState('en')
        const [terminal, setTerminal] = useState('')
        const [lastDarkTheme, setLastDarkTheme] = useState('vscode-dark')
        const [lastLightTheme, setLastLightTheme] = useState('vscode-light')
        const customThemesStrRef = useRef('[]')

        useEffect(() => {
            GetSettings().then(s => {
                if (!s) return
                const t = s.theme || 'vscode-dark'
                setTheme(t)
                setDensity(s.density || 'comfortable')
                setUiFont(s.uiFont || 'Inter')
                setMonoFont(s.monoFont || 'JetBrains Mono')
                setLocale(s.locale || 'en')
                setTerminal(s.terminal || '')
                applyTheme(t)
                applyDensity(s.density || 'comfortable')
                applyFonts(s.uiFont || 'Inter', s.monoFont || 'JetBrains Mono')
                if (s.customThemes && s.customThemes !== '[]') {
                    try {
                        const parsed = JSON.parse(s.customThemes)
                        setCustomThemes(Array.isArray(parsed) ? parsed : [])
                        customThemesStrRef.current = s.customThemes
                    } catch {}
                }
            }).catch(() => {})
        }, [])

        const persistSettings = useCallback(async (newSettings: Record<string, unknown>) => {
            try {
                await SetSettings(JSON.stringify(newSettings))
                Events.Emit(eventNames.settingsChanged, newSettings)
            } catch (err) {
                toast.error('Failed to save settings: ' + String(err))
                console.error('SetSettings error:', err)
            }
        }, [])

        const handleThemeChange = useCallback((newTheme: string) => {
            const builtIn = THEMES.find(t => t.id === newTheme)
            const custom = customThemes.find(t => t.id === newTheme)
            const themeType = builtIn?.type ?? custom?.type ?? 'dark'
            applyTheme(newTheme)
            if (themeType === 'dark') {
                setLastDarkTheme(newTheme)
                document.documentElement.style.setProperty('--cmdex-last-dark-theme', newTheme)
            } else {
                setLastLightTheme(newTheme)
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
            const newSettings = {
                locale, terminal, theme: newTheme,
                lastDarkTheme: themeType === 'dark' ? newTheme : lastDarkTheme,
                lastLightTheme: themeType === 'light' ? newTheme : lastLightTheme,
                customThemes: customThemesStrRef.current,
                uiFont, monoFont, density,
            }
            persistSettings(newSettings)
        }, [customThemes, locale, terminal, theme, uiFont, monoFont, density, persistSettings, lastDarkTheme, lastLightTheme])

        const handleDensityChange = useCallback((d: string) => {
            setDensity(d)
            applyDensity(d)
            const newSettings = {
                locale, terminal, theme, lastDarkTheme, lastLightTheme,
                customThemes: customThemesStrRef.current, uiFont, monoFont, density: d,
            }
            persistSettings(newSettings)
        }, [locale, terminal, theme, uiFont, monoFont, persistSettings, lastDarkTheme, lastLightTheme])

        const handleUiFontChange = useCallback((font: string) => {
            setUiFont(font)
            applyFonts(font, monoFont)
            const newSettings = {
                locale, terminal, theme, lastDarkTheme, lastLightTheme,
                customThemes: customThemesStrRef.current, uiFont: font, monoFont, density,
            }
            persistSettings(newSettings)
        }, [locale, terminal, theme, monoFont, density, persistSettings, lastDarkTheme, lastLightTheme])

        const handleMonoFontChange = useCallback((font: string) => {
            setMonoFont(font)
            applyFonts(uiFont, font)
            const newSettings = {
                locale, terminal, theme, lastDarkTheme, lastLightTheme,
                customThemes: customThemesStrRef.current, uiFont, monoFont: font, density,
            }
            persistSettings(newSettings)
        }, [locale, terminal, theme, uiFont, density, persistSettings, lastDarkTheme, lastLightTheme])

        const handleImportTheme = useCallback((importedTheme: CustomTheme) => {
            const updated = [...customThemes, importedTheme]
            setCustomThemes(updated)
            customThemesStrRef.current = JSON.stringify(updated)
        }, [customThemes])

        const handleRemoveCustomTheme = useCallback((themeId: string) => {
            const updated = customThemes.filter(t => t.id !== themeId)
            setCustomThemes(updated)
            customThemesStrRef.current = JSON.stringify(updated)
        }, [customThemes])

        return (
            <SettingsPage
                theme={theme}
                onThemeChange={handleThemeChange}
                customThemes={customThemes}
                onImportTheme={handleImportTheme}
                onRemoveCustomTheme={handleRemoveCustomTheme}
                density={density}
                onDensityChange={handleDensityChange}
                uiFont={uiFont}
                monoFont={monoFont}
                onUiFontChange={handleUiFontChange}
                onMonoFontChange={handleMonoFontChange}
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