"use client";

import { Settings2 } from "lucide-react";
import { gameTypeLabel, penaltyModeLabel, type RoomSettings } from "@/lib/rules";

type RoomSettingsProps = {
  settings: RoomSettings;
  onChange: (patch: Partial<RoomSettings>) => void;
  title?: string;
  description?: string;
  idPrefix?: string;
};

const penaltyOptions: Array<{ value: RoomSettings["pickTwoMode"]; label: string }> = [
  { value: "stack", label: "Stack penalty" },
  { value: "block", label: "Block + clear" },
  { value: "none", label: "No defence" },
];

export function RoomSettingsPanel({
  settings,
  onChange,
  title = "House rules",
  description = "Every switch is shown to players before they join.",
  idPrefix = "room-settings",
}: RoomSettingsProps) {
  return (
    <details className="settings-accordion" open>
      <summary>
        <span className="settings-summary-title"><Settings2 size={16} /> {title}</span>
        <span className="settings-summary-value">{gameTypeLabel(settings.gameType, settings.targetScore)} · {settings.initialHand} cards</span>
      </summary>
      <div className="settings-body">
        <p className="settings-intro">{description} Set the exact behaviour for 2 Pick Two, 5 Pick Three, 8 Suspension, and every optional power card.</p>

        <details className="settings-section" open>
          <summary className="settings-section-heading">
            <div><h3>Match format</h3><p>Choose the shape of the round and how quickly turns move.</p></div>
          </summary>
          <div className="settings-grid">
            <div className="form-field">
              <label htmlFor={`${idPrefix}-game-type`}>Game type</label>
              <select className="form-select" id={`${idPrefix}-game-type`} onChange={(event) => onChange({ gameType: event.target.value as RoomSettings["gameType"] })} value={settings.gameType}>
                <option value="classic">Classic round</option>
                <option value="knockout">Knockout scoring</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor={`${idPrefix}-initial-hand`}>Opening hand</label>
              <select className="form-select" id={`${idPrefix}-initial-hand`} onChange={(event) => onChange({ initialHand: Number(event.target.value) as RoomSettings["initialHand"] })} value={settings.initialHand}>
                {[3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} cards each</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor={`${idPrefix}-draw-mode`}>When you cannot play</label>
              <select className="form-select" id={`${idPrefix}-draw-mode`} onChange={(event) => onChange({ drawMode: event.target.value as RoomSettings["drawMode"] })} value={settings.drawMode}>
                <option value="one">Draw one and pass</option>
                <option value="until-playable">Draw until playable</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor={`${idPrefix}-timer`}>Turn timer</label>
              <select className="form-select" id={`${idPrefix}-timer`} onChange={(event) => onChange({ turnTimer: event.target.value as RoomSettings["turnTimer"] })} value={settings.turnTimer}>
                <option value="off">No timer</option>
                <option value="10">10 seconds</option>
                <option value="15">15 seconds</option>
                <option value="30">30 seconds</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor={`${idPrefix}-target-score`}>Knockout target</label>
              <select className="form-select" id={`${idPrefix}-target-score`} onChange={(event) => onChange({ targetScore: Number(event.target.value) as RoomSettings["targetScore"] })} value={settings.targetScore}>
                <option value="50">Eliminate at 50</option>
                <option value="100">Eliminate at 100</option>
                <option value="200">Eliminate at 200</option>
              </select>
              <span className="form-helper">Used when knockout scoring is selected.</span>
            </div>
            <div className="form-field">
              <label>Direction</label>
              <div className="form-checkboxes">
                <label className="check-chip check-chip-toggle"><input checked={settings.clockwise} onChange={(event) => onChange({ clockwise: event.target.checked })} type="checkbox" /> Clockwise play</label>
              </div>
            </div>
          </div>
        </details>

        <details className="settings-section">
          <summary className="settings-section-heading">
            <div><h3>Core switches</h3><p>Decide which calls and scoring conventions this room uses.</p></div>
          </summary>
          <div className="form-checkboxes">
            <label className="check-chip check-chip-toggle"><input checked={settings.endCalls} onChange={(event) => onChange({ endCalls: event.target.checked })} type="checkbox" /> Semi-last / last calls</label>
            <label className="check-chip check-chip-toggle"><input checked={settings.starDouble} onChange={(event) => onChange({ starDouble: event.target.checked })} type="checkbox" /> Star cards count double</label>
            <label className="check-chip check-chip-toggle"><input checked={settings.whotCallsSuit} disabled={!settings.whotEnabled} onChange={(event) => onChange({ whotCallsSuit: event.target.checked })} type="checkbox" /> Whot calls a symbol</label>
          </div>
        </details>

        <details className="settings-section">
          <summary className="settings-section-heading">
            <div><h3>Power cards</h3><p>Turn individual actions on or off. Disabled cards still match by their printed number or symbol.</p></div>
          </summary>
          <div className="settings-power-grid">
            <label className="check-chip check-chip-toggle"><input checked={settings.holdOnEnabled} onChange={(event) => onChange({ holdOnEnabled: event.target.checked })} type="checkbox" /> <strong>1</strong> Hold On</label>
            <label className="check-chip check-chip-toggle"><input checked={settings.suspensionEnabled} onChange={(event) => onChange({ suspensionEnabled: event.target.checked })} type="checkbox" /> <strong>8</strong> Suspension</label>
            <label className="check-chip check-chip-toggle"><input checked={settings.generalMarketEnabled} onChange={(event) => onChange({ generalMarketEnabled: event.target.checked })} type="checkbox" /> <strong>14</strong> General Market</label>
            <label className="check-chip check-chip-toggle"><input checked={settings.whotEnabled} onChange={(event) => onChange({ whotEnabled: event.target.checked, whotCallsSuit: event.target.checked ? settings.whotCallsSuit : false })} type="checkbox" /> <strong>20</strong> Whot / Crown</label>
          </div>
        </details>

        <details className="settings-section">
          <summary className="settings-section-heading">
            <div><h3>Draw penalties</h3><p>“Block + clear” lets the next player answer a penalty card and cancel the current draw.</p></div>
          </summary>
          <div className="settings-penalty-list">
            <PenaltySetting
              description="Next player draws two cards."
              enabled={settings.pickTwoEnabled}
              id={`${idPrefix}-pick-two`}
              label="2 · Pick Two"
              mode={settings.pickTwoMode}
              onEnabledChange={(enabled) => onChange({ pickTwoEnabled: enabled })}
              onModeChange={(pickTwoMode) => onChange({ pickTwoMode })}
            />
            <PenaltySetting
              description="Next player draws three cards."
              enabled={settings.pickThreeEnabled}
              id={`${idPrefix}-pick-three`}
              label="5 · Pick Three"
              mode={settings.pickThreeMode}
              onEnabledChange={(enabled) => onChange({ pickThreeEnabled: enabled })}
              onModeChange={(pickThreeMode) => onChange({ pickThreeMode })}
            />
          </div>
        </details>

        <div className="settings-footnote"><strong>Current preset:</strong> {gameTypeLabel(settings.gameType, settings.targetScore)} · {settings.initialHand}-card deal · {settings.pickTwoEnabled ? penaltyModeLabel(settings.pickTwoMode) : "2 disabled"} · {settings.pickThreeEnabled ? penaltyModeLabel(settings.pickThreeMode) : "5 disabled"}.</div>
      </div>
    </details>
  );
}

type PenaltySettingProps = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  mode: RoomSettings["pickTwoMode"];
  onEnabledChange: (enabled: boolean) => void;
  onModeChange: (mode: RoomSettings["pickTwoMode"]) => void;
};

function PenaltySetting({ id, label, description, enabled, mode, onEnabledChange, onModeChange }: PenaltySettingProps) {
  return (
    <div className="settings-penalty-row">
      <label className="settings-penalty-toggle" htmlFor={id}>
        <input checked={enabled} id={id} onChange={(event) => onEnabledChange(event.target.checked)} type="checkbox" />
        <span><strong>{label}</strong><small>{description}</small></span>
      </label>
      <select aria-label={`${label} behaviour`} className="form-select settings-penalty-select" disabled={!enabled} onChange={(event) => onModeChange(event.target.value as RoomSettings["pickTwoMode"])} value={mode}>
        {penaltyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
