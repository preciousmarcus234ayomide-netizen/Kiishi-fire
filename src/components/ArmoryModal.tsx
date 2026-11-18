import React, { useState } from 'react';
import { X, Crosshair, Check, Lock } from 'lucide-react';
import { ATTACHMENTS, WEAPONS, WEAPON_SKINS, WeaponCategory } from '../game/catalog';
import { UserProfile } from '../services/gameDb';
import { soundEngine } from '../game/audio';

interface ArmoryModalProps {
  profile: UserProfile;
  equippedSkins: Record<string, string>;
  equippedAttachments: string[];
  onClose: () => void;
  onEquipWeapon: (weaponId: string) => void;
  onEquipSkin: (weaponId: string, skinId: string) => void;
  onToggleAttachment: (attachmentId: string) => void;
  onUnlockItem: (itemId: string, name: string, currency: 'gold' | 'diamonds', price: number) => Promise<void>;
}

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  profile,
  equippedSkins,
  equippedAttachments,
  onClose,
  onEquipWeapon,
  onEquipSkin,
  onToggleAttachment,
  onUnlockItem,
}) => {
  const [cat, setCat] = useState<'all' | WeaponCategory>('all');
  const [tab, setTab] = useState<'weapons' | 'skins' | 'attachments' | 'gear'>('weapons');
  const [busyId, setBusyId] = useState<string | null>(null);

  const weaponList = Object.values(WEAPONS).filter((w) => cat === 'all' || w.category === cat);
  const unlocked = new Set(profile.unlockedItems || []);

  const handleUnlock = async (id: string, name: string, currency: 'gold' | 'diamonds', price: number) => {
    setBusyId(id);
    try {
      await onUnlockItem(id, name, currency, price);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-[#0C121E] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[86vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crosshair className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-black uppercase tracking-wider text-white">Tactical Armory & Loadout</h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold tabular-nums">
            <span className="text-amber-400">{profile.gold.toLocaleString()} Gold</span>
            <span className="text-sky-400">{profile.diamonds.toLocaleString()} Diamonds</span>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subtabs */}
        <div className="px-6 pt-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex gap-1.5">
            {(['weapons', 'skins', 'attachments', 'gear'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  soundEngine.playUiClick();
                  setTab(t);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                  tab === t ? 'bg-orange-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'weapons' && (
            <div className="flex gap-1 text-[11px] font-bold">
              {(['all', 'ar', 'sniper', 'smg', 'shotgun', 'pistol'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={`px-2.5 py-1 rounded uppercase cursor-pointer ${
                    cat === c ? 'bg-cyan-400 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'weapons' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weaponList.map((w) => {
                const isUnlocked = unlocked.has(w.id) || (w.priceGold === 0 && w.priceDiamonds === 0);
                const isEquipped = profile.selectedWeapon === w.id;
                const activeSkin = WEAPON_SKINS.find((s) => s.id === equippedSkins[w.id]);
                return (
                  <div
                    key={w.id}
                    className={`p-4 rounded-xl border transition ${
                      isEquipped
                        ? 'bg-orange-500/10 border-orange-500'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-400">
                          {w.category} · {w.ammoType}
                        </span>
                        <h3 className="text-base font-black text-white mt-1">
                          {w.name}
                          {activeSkin && (
                            <span className="ml-2 text-[10px] font-bold text-orange-400">[{activeSkin.name}]</span>
                          )}
                        </h3>
                      </div>
                      <span className="text-xs font-mono text-slate-400">MAG {w.magSize}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">{w.description}</p>

                    {/* Stat Bars */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] mb-4 tabular-nums">
                      {[
                        ['Damage', Math.min(100, w.damage * (w.pellets > 1 ? 4 : 1))],
                        ['Accuracy', w.accuracy],
                        ['Range', Math.min(100, Math.round((w.range / 260) * 100))],
                        ['Reload', Math.min(100, Math.round((1500 / w.reloadTimeMs) * 80))],
                        ['Stability', Math.max(10, 100 - w.recoil)],
                      ].map(([label, val]) => (
                        <div key={String(label)}>
                          <div className="flex justify-between text-slate-300">
                            <span>{label}</span>
                            <span className="font-bold">{val}</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                            <div className="h-full bg-orange-500" style={{ width: `${val}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {isUnlocked ? (
                      <button
                        onClick={() => {
                          soundEngine.playUiClick();
                          onEquipWeapon(w.id);
                        }}
                        className={`w-full py-2 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer ${
                          isEquipped
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                            : 'bg-orange-500 hover:bg-orange-400 text-slate-950'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {isEquipped ? 'Equipped in Lobby' : 'Equip Primary'}
                      </button>
                    ) : (
                      <button
                        disabled={busyId === w.id || profile.gold < w.priceGold}
                        onClick={() => handleUnlock(w.id, w.name, 'gold', w.priceGold)}
                        className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Unlock · {w.priceGold.toLocaleString()} Gold
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'skins' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WEAPON_SKINS.map((sk) => {
                const owned = unlocked.has(sk.id);
                const isEquipped = equippedSkins[sk.weaponId] === sk.id;
                return (
                  <div key={sk.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-orange-400">{sk.rarity}</span>
                      <h4 className="font-black text-white">{sk.name}</h4>
                      <p className="text-xs text-cyan-400 mt-0.5">{sk.bonusStat}</p>
                    </div>
                    {owned ? (
                      <button
                        onClick={() => {
                          soundEngine.playUiClick();
                          onEquipSkin(sk.weaponId, isEquipped ? '' : sk.id);
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase cursor-pointer ${
                          isEquipped
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                            : 'bg-orange-500 hover:bg-orange-400 text-slate-950'
                        }`}
                      >
                        {isEquipped ? 'Equipped' : 'Equip Skin'}
                      </button>
                    ) : (
                      <button
                        disabled={busyId === sk.id || profile.diamonds < sk.priceDiamonds}
                        onClick={() => handleUnlock(sk.id, sk.name, 'diamonds', sk.priceDiamonds)}
                        className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-45 text-slate-950 text-xs font-black cursor-pointer"
                      >
                        {sk.priceDiamonds} Diamonds
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'attachments' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ATTACHMENTS.map((att) => {
                const owned = unlocked.has(att.id);
                const active = equippedAttachments.includes(att.id);
                return (
                  <div key={att.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400">{att.slot}</span>
                      <h4 className="font-bold text-white">{att.name}</h4>
                      <p className="text-xs text-emerald-400">{att.effect}</p>
                    </div>
                    {owned ? (
                      <button
                        onClick={() => {
                          soundEngine.playUiClick();
                          onToggleAttachment(att.id);
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase cursor-pointer ${
                          active
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        {active ? 'Equipped' : 'Attach'}
                      </button>
                    ) : (
                      <button
                        disabled={busyId === att.id || profile.gold < att.priceGold}
                        onClick={() => handleUnlock(att.id, att.name, 'gold', att.priceGold)}
                        className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-black cursor-pointer"
                      >
                        {att.priceGold} Gold
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'gear' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name: 'Body Armor Lv.1–Lv.3', desc: 'Absorbs 15%–45% incoming torso ballistic damage.', tag: 'FIELD LOOT' },
                { name: 'Ballistic Helmet Lv.1–Lv.3', desc: 'Reduces headshot critical multipliers by up to 42%.', tag: 'FIELD LOOT' },
                { name: 'Tactical Medkit', desc: 'Restores +60 HP over a 2.2s channel [Press H].', tag: 'CONSUMABLE' },
                { name: 'HE Frag Grenade', desc: '2.2s fuse dealing up to 92 AoE blast damage [Press G].', tag: 'ORDNANCE' },
              ].map((g) => (
                <div key={g.name} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase">{g.tag}</span>
                  <h4 className="font-black text-white mt-1">{g.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{g.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
