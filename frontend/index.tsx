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

let currentDocument: Document | undefined;

const SettingsContent = () => {
  const [message, setMessage] = useState('');
  const [horizontalOffset, setHorizontalOffset] = useState('0');
  const [showViewDetails, setShowViewDetails] = useState(true);
  const [alignRight, setAlignRight] = useState(true);

  useEffect(() => {
    const settings = getSettings();
    setHorizontalOffset(String(settings.horizontalOffset));
    setShowViewDetails(settings.showViewDetails);
    setAlignRight(settings.alignRight);
  }, []);

  const onOffsetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHorizontalOffset(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      saveSettings({ ...getSettings(), horizontalOffset: numValue });
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

  const onCacheStats = () => {
    const stats = getCacheStats();
    if (stats.count === 0) {
      setMessage('Cache is empty');
    } else {
      const age = stats.oldestTimestamp
        ? Math.round((Date.now() - stats.oldestTimestamp) / (1000 * 60 * 60 * 24))
        : 0;
      setMessage(`${stats.count} games cached, oldest is ${age} days old`);
    }
  };

  const onClearCache = () => {
    clearCache();
    setMessage('Cache cleared');
  };

  return (
    <>
      <Field label="Align to Right" description="Position on right side of header. Disable for left side." bottomSeparator="standard">
        <input
          type="checkbox"
          checked={alignRight}
          onChange={(e) => onAlignRightChange(e.target.checked)}
          style={{ width: '20px', height: '20px' }}
        />
      </Field>
      <Field label="Horizontal Offset (px)" description="Distance from edge. Default: 0" bottomSeparator="standard">
        <input
          type="number"
          min={0}
          value={horizontalOffset}
          onChange={onOffsetChange}
          style={{ width: '60px', padding: '4px 8px' }}
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

export default definePlugin(() => {
  log('HLTB plugin loading...');

  Millennium.AddWindowCreateHook?.((context: any) => {
    // Only handle main Steam windows (Desktop or Big Picture)
    if (!context.m_strName?.startsWith('SP ')) return;

    const doc = context.m_popup?.document;
    if (!doc?.body) return;

    log('Window created:', context.m_strName);

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
  });

  return {
    title: 'HLTB for Steam',
    icon: <IconsModule.Settings />,
    content: <SettingsContent />,
  };
});
