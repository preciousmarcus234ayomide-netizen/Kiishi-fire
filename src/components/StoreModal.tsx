import React, { useState } from 'react';
import { X, ShoppingBag, Gem, Coins, CreditCard, CheckCircle2 } from 'lucide-react';
import { COSMETIC_ITEMS, STORE_BUNDLES, WEAPON_SKINS } from '../game/catalog';
import { recordTransactionAndPurchase, UserProfile } from '../services/gameDb';
import { soundEngine } from '../game/audio';

interface StoreModalProps {
  profile: UserProfile;
  isLocalGuest: boolean;
  onLocalProfileUpdate: (updater: (p: UserProfile) => UserProfile) => void;
  onClose: () => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({
  profile,
  isLocalGuest,
  onLocalProfileUpdate,
  onClose,
}) => {
  const [tab, setTab] = useState<'featured' | 'currency' | 'skins' | 'outfits'>('featured');
  const [busy, setBusy] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const unlocked = new Set(profile.unlockedItems || []);

  const handlePurchase = async (opts: {
    itemId: string;
    itemName: string;
    currency: 'gold' | 'diamonds' | 'usd';
    amount: number;
    unlockItemIds?: string[];
    goldDelta?: number;
    diamondsDelta?: number;
    grantElitePass?: boolean;
  }) => {
    soundEngine.playUiClick();
    setBusy(opts.itemId);
    setReceipt(null);
    try {
      if (opts.currency === 'usd') {
        const res = await fetch('/api/payments/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: profile.uid, itemId: opts.itemId, amountUsd: opts.amount }),
        });
        const data = await res.json();
        if (!data.verified) throw new Error('Payment verification failed');
        setReceipt(`Verified Order ${data.receiptId} — Credited ${opts.itemName}`);
      } else {
        setReceipt(`Purchased ${opts.itemName}`);
      }

      if (isLocalGuest) {
        onLocalProfileUpdate((p) => ({
          ...p,
          gold: Math.max(0, p.gold + (opts.goldDelta || 0) - (opts.currency === 'gold' ? opts.amount : 0)),
          diamonds: Math.max(0, p.diamonds + (opts.diamondsDelta || 0) - (opts.currency === 'diamonds' ? opts.amount : 0)),
          unlockedItems: Array.from(new Set([...(p.unlockedItems || []), ...(opts.unlockItemIds || [])])),
          hasElitePass: opts.grantElitePass ? true : p.hasElitePass,
        }));
      } else {
        await recordTransactionAndPurchase(profile, opts);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-[#0C121E] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[86vh]">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-black uppercase tracking-wider text-white">Emberfall Store</h2>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold tabular-nums">
            <span className="flex items-center gap-1 text-amber-400">
              <Coins className="w-3.5 h-3.5" /> {profile.gold.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-sky-400">
              <Gem className="w-3.5 h-3.5" /> {profile.diamonds.toLocaleString()}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-slate-800 flex gap-2">
          {(['featured', 'currency', 'skins', 'outfits'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                tab === t ? 'bg-orange-500 text-slate-950' : 'bg-slate-900 text-slate-300 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {receipt && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{receipt}</span>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">
          {tab === 'featured' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {STORE_BUNDLES.filter((b) => b.category !== 'currency').map((b) => {
                const alreadyPass = b.id === 'bundle_elite_pass' && profile.hasElitePass;
                return (
                  <div key={b.id} className="p-5 rounded-xl bg-gradient-to-br from-slate-900 to-[#161e31] border border-orange-500/35 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
                        {b.badge}
                      </span>
                      <h3 className="text-lg font-black text-white mt-2">{b.name}</h3>
                      <p className="text-xs text-slate-300 mt-1">
                        {b.id === 'bundle_elite_pass'
                          ? 'Unlocks all 12 Elite Battle Pass tiers, exclusive skins, and +1,000 Gold.'
                          : 'Includes Solaris Sovereign Suit, AK-47 Dragon Core, Champion Flex, and +2,000 Gold.'}
                      </p>
                    </div>
                    <button
                      disabled={busy === b.id || alreadyPass || profile.diamonds < b.price}
                      onClick={() =>
                        handlePurchase({
                          itemId: b.id,
                          itemName: b.name,
                          currency: 'diamonds',
                          amount: b.price,
                          unlockItemIds: b.unlocks,
                          goldDelta: b.goldGiven,
                          grantElitePass: b.id === 'bundle_elite_pass',
                        })
                      }
                      className="mt-4 w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-45 text-slate-950 text-xs font-black uppercase cursor-pointer"
                    >
                      {alreadyPass ? 'Elite Pass Active' : `${b.price} Diamonds`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'currency' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STORE_BUNDLES.filter((b) => b.category === 'currency').map((b) => (
                <div key={b.id} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase text-cyan-400">{b.badge}</span>
                    <h4 className="font-black text-white text-base">{b.name}</h4>
                    <p className="text-xs text-slate-400">
                      {b.diamondsGiven > 0 ? `+${b.diamondsGiven} Diamonds ` : ''}
                      {b.goldGiven > 0 ? `+${b.goldGiven.toLocaleString()} Gold` : ''}
                    </p>
                  </div>
                  <button
                    disabled={busy === b.id || (b.currency === 'diamonds' && profile.diamonds < b.price)}
                    onClick={() =>
                      handlePurchase({
                        itemId: b.id,
                        itemName: b.name,
                        currency: b.currency as 'diamonds' | 'usd',
                        amount: b.price,
                        goldDelta: b.goldGiven,
                        diamondsDelta: b.diamondsGiven,
                      })
                    }
                    className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:opacity-45 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    {b.currency === 'usd' && <CreditCard className="w-3.5 h-3.5" />}
                    {b.currency === 'usd' ? `$${b.price.toFixed(2)}` : `${b.price} Dia`}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'skins' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {WEAPON_SKINS.map((sk) => {
                const owned = unlocked.has(sk.id);
                return (
                  <div key={sk.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-orange-400">{sk.rarity}</span>
                      <h4 className="font-black text-white">{sk.name}</h4>
                      <p className="text-xs text-cyan-400">{sk.bonusStat}</p>
                    </div>
                    <button
                      disabled={owned || busy === sk.id || profile.diamonds < sk.priceDiamonds}
                      onClick={() =>
                        handlePurchase({
                          itemId: sk.id,
                          itemName: sk.name,
                          currency: 'diamonds',
                          amount: sk.priceDiamonds,
                          unlockItemIds: [sk.id],
                        })
                      }
                      className="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-45 text-slate-950 text-xs font-black cursor-pointer"
                    >
                      {owned ? 'Owned' : `${sk.priceDiamonds} Dia`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'outfits' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {COSMETIC_ITEMS.filter((c) => c.priceGold > 0 || c.priceDiamonds > 0).map((c) => {
                const owned = unlocked.has(c.id);
                const useGold = c.priceGold > 0;
                const price = useGold ? c.priceGold : c.priceDiamonds;
                return (
                  <div key={c.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-cyan-400">{c.slot} · {c.rarity}</span>
                      <h4 className="font-bold text-white text-sm">{c.name}</h4>
                    </div>
                    <button
                      disabled={owned || busy === c.id || (useGold ? profile.gold < price : profile.diamonds < price)}
                      onClick={() =>
                        handlePurchase({
                          itemId: c.id,
                          itemName: c.name,
                          currency: useGold ? 'gold' : 'diamonds',
                          amount: price,
                          unlockItemIds: [c.id],
                        })
                      }
                      className={`px-3.5 py-2 rounded-lg disabled:opacity-45 text-slate-950 text-xs font-black cursor-pointer ${
                        useGold ? 'bg-amber-500 hover:bg-amber-400' : 'bg-sky-500 hover:bg-sky-400'
                      }`}
                    >
                      {owned ? 'Owned' : `${price} ${useGold ? 'Gold' : 'Dia'}`}
                    </button>
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
