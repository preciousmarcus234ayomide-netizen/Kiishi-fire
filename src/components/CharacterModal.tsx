import React, { useState } from 'react';
import { X, Sparkles, ArrowUpCircle, Check, Lock } from 'lucide-react';
import { CHARACTERS, COSMETIC_ITEMS } from '../game/catalog';
import { UserProfile } from '../services/gameDb';
import { soundEngine } from '../game/audio';

interface CharacterModalProps {
  profile: UserProfile;
  onClose: () => void;
  onSelectCharacter: (charId: string) => void;
  onUpgradeCharacter: (charId: string) => Promise<void>;
  onEquipCosmetic: (slot: 'outfit' | 'hair' | 'accessory' | 'emote', id: string) => void;
  onUnlockItem: (id: string, name: string, currency: 'gold' | 'diamonds', price: number) => Promise<void>;
}

export const CharacterModal: React.FC<CharacterModalProps> = ({
  profile,
  onClose,
  onSelectCharacter,
  onUpgradeCharacter,
  onEquipCosmetic,
  onUnlockItem,
}) => {
  const [tab, setTab] = useState<'operators' | 'outfit' | 'hair' | 'accessory' | 'emote'>('operators');
  const unlocked = new Set(profile.unlockedItems || []);

  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-[#0C121E] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[86vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-black uppercase tracking-wider text-white">Operators & Style</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-800 flex flex-wrap gap-1.5">
          {(
            [
              ['operators', 'Characters'],
              ['outfit', 'Outfits'],
              ['hair', 'Hairstyles'],
              ['accessory', 'Shoes & Gear'],
              ['emote', 'Emotes'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                soundEngine.playUiClick();
                setTab(id);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                tab === id ? 'bg-orange-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'operators' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(CHARACTERS).map((c) => {
                const isUnlocked = unlocked.has(c.id) || c.priceGold === 0;
                const isSelected = profile.selectedCharacter === c.id;
                const lvl = profile.characterLevels?.[c.id] || 1;
                const upgradeCost = lvl * 600;

                return (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border ${
                      isSelected ? 'bg-orange-500/10 border-orange-500' : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-cyan-400">
                          {c.title} · {c.gender === 'female' ? 'Female Operator' : 'Male Operator'}
                        </span>
                        <h3 className="text-lg font-black text-white">{c.name}</h3>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-slate-800 text-xs font-black text-amber-400">
                        LV.{lvl}
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 mb-3">
                      <div className="text-xs font-bold text-orange-400">
                        Ability: {c.abilityName} ({c.cooldownSec}s CD)
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">{c.abilityDesc}</p>
                    </div>

                    <div className="flex gap-2">
                      {isUnlocked ? (
                        <>
                          <button
                            onClick={() => onSelectCharacter(c.id)}
                            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                                : 'bg-orange-500 hover:bg-orange-400 text-slate-950'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                          <button
                            disabled={lvl >= 5 || profile.gold < upgradeCost}
                            onClick={() => onUpgradeCharacter(c.id)}
                            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-xs font-bold text-amber-300 flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            {lvl >= 5 ? 'MAX' : `${upgradeCost}G`}
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={profile.gold < c.priceGold}
                          onClick={() => onUnlockItem(c.id, c.name, 'gold', c.priceGold)}
                          className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Lock className="w-3.5 h-3.5" /> Unlock · {c.priceGold.toLocaleString()} Gold
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {COSMETIC_ITEMS.filter((item) => item.slot === tab).map((item) => {
                const isUnlocked = unlocked.has(item.id) || (item.priceGold === 0 && item.priceDiamonds === 0);
                const equippedId =
                  tab === 'outfit'
                    ? profile.equippedOutfit
                    : tab === 'hair'
                      ? profile.equippedHair
                      : tab === 'accessory'
                        ? profile.equippedAccessory
                        : profile.equippedEmote;
                const isEquipped = equippedId === item.id;

                return (
                  <div key={item.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg border border-white/20 shrink-0"
                        style={{ backgroundColor: item.colorHex }}
                      />
                      <div>
                        <span className="text-[10px] font-bold uppercase text-orange-400">{item.rarity}</span>
                        <h4 className="font-bold text-white text-sm">{item.name}</h4>
                        <p className="text-xs text-slate-400">{item.description}</p>
                      </div>
                    </div>
                    {isUnlocked ? (
                      <button
                        onClick={() => onEquipCosmetic(tab, item.id)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase cursor-pointer ${
                          isEquipped
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                            : 'bg-orange-500 hover:bg-orange-400 text-slate-950'
                        }`}
                      >
                        {isEquipped ? (tab === 'emote' ? 'Play Emote' : 'Equipped') : 'Equip'}
                      </button>
                    ) : item.priceGold > 0 ? (
                      <button
                        disabled={profile.gold < item.priceGold}
                        onClick={() => onUnlockItem(item.id, item.name, 'gold', item.priceGold)}
                        className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-45 text-slate-950 text-xs font-black cursor-pointer"
                      >
                        {item.priceGold} Gold
                      </button>
                    ) : (
                      <button
                        disabled={profile.diamonds < item.priceDiamonds}
                        onClick={() => onUnlockItem(item.id, item.name, 'diamonds', item.priceDiamonds)}
                        className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-45 text-slate-950 text-xs font-black cursor-pointer"
                      >
                        {item.priceDiamonds} Dia
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
