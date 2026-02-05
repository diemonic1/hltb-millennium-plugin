import { useState, useEffect } from 'react';
import { definePlugin, Millennium, IconsModule, Field, DialogButton } from '@steambrew/client';
import { log } from './services/logger';
import { LIBRARY_SELECTORS } from './types';
import { setupObserver, resetState, disconnectObserver, refreshDisplay } from './injection/observer';
import { exposeDebugTools, removeDebugTools } from './debug/tools';
import { removeStyles } from './display/styles';
import { removeExistingDisplay } from './display/components';
import { clearCache, getCacheStats } from './services/cache';
import { getSettings, saveSettings } from './services/settings';
import { initializeIdCache } from './services/hltbApi';
import { getIdCacheStats, clearIdCache } from './services/hltbIdCache';

let currentDocument: Document | undefined;
let initializedForUserId: string | null = null;

const SettingsContent = () => {
  const [message, setMessage] = useState('');
  const [horizontalOffset, setHorizontalOffset] = useState('0');
  const [verticalOffset, setVerticalOffset] = useState('0');
  const [showViewDetails, setShowViewDetails] = useState(true);
  const [alignRight, setAlignRight] = useState(true);
  const [alignBottom, setAlignBottom] = useState(true);

  useEffect(() => {
    const settings = getSettings();
    setHorizontalOffset(String(settings.horizontalOffset));
    setVerticalOffset(String(settings.verticalOffset));
    setShowViewDetails(settings.showViewDetails);
    setAlignRight(settings.alignRight);
    setAlignBottom(settings.alignBottom);
  }, []);

  const onHorizontalOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHorizontalOffset(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      saveSettings({ ...getSettings(), horizontalOffset: numValue });
      refreshDisplay();
    }
  };

  const onVerticalOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setVerticalOffset(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      saveSettings({ ...getSettings(), verticalOffset: numValue });
      refreshDisplay();
    }
  };

  const onShowViewDetailsChange = (checked: boolean) => {
    setShowViewDetails(checked);
    saveSettings({ ...getSettings(), showViewDetails: checked });
    refreshDisplay();
  };

  const onAlignRightChange = (checked: boolean) => {
    setAlignRight(checked);
    saveSettings({ ...getSettings(), alignRight: checked });
    refreshDisplay();
  };

  const onAlignBottomChange = (checked: boolean) => {
    setAlignBottom(checked);
    saveSettings({ ...getSettings(), alignBottom: checked });
    refreshDisplay();
  };

  const onCacheStats = () => {
    const stats = getCacheStats();
    const idStats = getIdCacheStats();

    const parts: string[] = [];

    // Result cache stats
    if (stats.count === 0) {
      parts.push('Result cache: empty');
    } else {
      const age = stats.oldestTimestamp
        ? Math.round((Date.now() - stats.oldestTimestamp) / (1000 * 60 * 60 * 24))
        : 0;
      parts.push(`Result cache: ${stats.count} games, oldest ${age}d`);
    }

    // ID cache stats
    if (idStats.count === 0) {
      parts.push('ID cache: empty');
    } else {
      const age = idStats.ageMs
        ? Math.round(idStats.ageMs / (1000 * 60 * 60 * 24))
        : 0;
      parts.push(`ID cache: ${idStats.count} mappings, ${age}d old`);
    }

    setMessage(parts.join(' | '));
  };

  const onClearCache = () => {
    clearCache();
    clearIdCache();
    setMessage('All caches cleared');
  };

  return (
    <>
      <Field label="Horizontal Offset (px)" description="Distance from edge. Default: 0" bottomSeparator="standard">
        <input
          type="number"
          min={0}
          value={horizontalOffset}
          onChange={onHorizontalOffsetChange}
          style={{ width: '60px', padding: '4px 8px' }}
        />
      </Field>
      <Field label="Vertical Offset (px)" description="Distance from edge. Default: 0" bottomSeparator="standard">
        <input
          type="number"
          min={0}
          value={verticalOffset}
          onChange={onVerticalOffsetChange}
          style={{ width: '60px', padding: '4px 8px' }}
        />
      </Field>
      <Field label="Align to Right" description="Position on right side of header. Disable for left side." bottomSeparator="standard">
        <input
          type="checkbox"
          checked={alignRight}
          onChange={(e) => onAlignRightChange(e.target.checked)}
          style={{ width: '20px', height: '20px' }}
        />
      </Field>
      <Field label="Align to Bottom" description="Position at bottom of header. Disable for top." bottomSeparator="standard">
        <input
          type="checkbox"
          checked={alignBottom}
          onChange={(e) => onAlignBottomChange(e.target.checked)}
          style={{ width: '20px', height: '20px' }}
        />
      </Field>
      <Field label="Show View Details Link" description="Display link to HLTB game page" bottomSeparator="standard">
        <input
          type="checkbox"
          checked={showViewDetails}
          onChange={(e) => onShowViewDetailsChange(e.target.checked)}
          style={{ width: '20px', height: '20px' }}
        />
      </Field>
      <Field label="Cache Statistics" bottomSeparator="standard">
        <DialogButton onClick={onCacheStats} style={{ padding: '8px 16px' }}>View Stats</DialogButton>
      </Field>
      <Field label="Clear Cache" bottomSeparator="standard">
        <DialogButton onClick={onClearCache} style={{ padding: '8px 16px' }}>Clear</DialogButton>
      </Field>
      {message && <Field description={message} />}
    </>
  );
};

window.lastClickedElement = "undefined";

export default definePlugin(() => {
  log('HLTB plugin loading...');

  Millennium.AddWindowCreateHook?.((context: any) => {
    // Only handle main Steam windows (Desktop or Big Picture)
    if (!context.m_strName?.startsWith('SP ')) return;

    const doc = context.m_popup?.document;
    if (!doc?.body) return;

    log('Window created:', context.m_strName);

    const popup_target = context.m_popup.document.getElementById('popup_target');

    if (context.m_strName === 'SP Desktop_uid0'
        && popup_target != null 
        && popup_target != undefined)
    {
      popup_target.addEventListener('mousedown', (e) => {
        try {
          log('try to get name for HLTB');
          
          const x = e.clientX;
          const y = e.clientY;

          const draggables = popup_target.querySelectorAll('[draggable="true"]');

          for (const el of draggables) {
            const rect = el.getBoundingClientRect();
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
              window.lastClickedElement = el.children[1].innerText;
              log('HLTB element was clicked: ' + window.lastClickedElement);
            }
          }
        } catch (error) {}
      });
    }

    // Clean up old document if switching modes
    if (currentDocument && currentDocument !== doc) {
      log('Mode switch detected, cleaning up old document');
      removeDebugTools(currentDocument);
      removeStyles(currentDocument);
      removeExistingDisplay(currentDocument);
      disconnectObserver();
      resetState();
    }

    currentDocument = doc;
    setupObserver(doc, LIBRARY_SELECTORS);
    exposeDebugTools(doc);

    // Initialize ID cache in background (non-blocking)
    // Uses HLTB's Steam import API to get steam_id -> hltb_id mappings
    // Skip if already successfully initialized for this user ID
    const steamUserId = (window as any).App?.m_CurrentUser?.strSteamID;
    if (steamUserId && steamUserId !== initializedForUserId) {
      initializeIdCache(steamUserId).then((success) => {
        if (success) {
          initializedForUserId = steamUserId;
          log('ID cache initialized successfully');
        }
      });
    }
  });

  return {
    title: 'HLTB for Steam',
    icon: <IconsModule.Settings />,
    content: <SettingsContent />,
  };
});
