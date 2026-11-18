# Emberfall Royale — Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Identity & Ownership**: A user profile at `/users/{userId}` can only be created when `uid == request.auth.uid`, `banned == false`, and `playerId` matches `^EFR-[A-Z0-9]{4,12}$`. A user cannot unban themselves or modify `banned`/`banReason`.
2. **PII Isolation**: Email addresses and personal settings reside strictly in `/users/{userId}/private/info`, readable/writable only by `userId == request.auth.uid` or `isAdmin()`.
3. **Immutable Audit Fields**: `createdAt`, `uid`, `playerId` on `/users/{userId}`, `ownerId` on `/matches/{matchId}`, and `userId` on `/transactions/{txId}` cannot be modified after creation.
4. **Temporal Integrity**: All `createdAt` and `updatedAt` fields must equal `request.time`.
5. **Social Graph Integrity**: Friendships in `/friends/{friendshipId}` can only be created by `requesterId == request.auth.uid` with `status == 'pending'`, and only `recipientId` can transition `status` to `'accepted'` or `'declined'`.
6. **Admin Isolation**: Only verified admins (`preciousmarcus234ayomide@gmail.com` with `email_verified == true` or `/admins/{uid}`) can manage `/events`, `/gameConfig`, ban users, resolve `/reports`, or list all `/transactions`.
7. **Anti-Shadow / Anti-Bloat**: Every write validates exact key allowlists (`hasAll`/`hasOnly` on create, `affectedKeys().hasOnly()` on update) and strict `.size()` bounds on strings and arrays.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Unban / Ban Tampering**: Update `/users/{uid}` with `{ banned: false }` by a banned user -> `PERMISSION_DENIED`.
2. **Shadow Ghost Field Injection**: Create `/users/{uid}` with extra field `{ isAdmin: true }` -> `PERMISSION_DENIED`.
3. **UID Spoofing**: Create `/users/{otherUid}` while authenticated as `uid` -> `PERMISSION_DENIED`.
4. **PII Leak Attempt**: Read `/users/{otherUid}/private/info` by non-owner non-admin -> `PERMISSION_DENIED`.
5. **Client Timestamp Forgery**: Create `/matches/{id}` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
6. **Auto-Accept Friend Spoof**: Create `/friends/{id}` with `status: 'accepted'` directly by requester -> `PERMISSION_DENIED`.
7. **Non-Recipient Friend Accept**: Requester updates `/friends/{id}` `status` to `'accepted'` -> `PERMISSION_DENIED`.
8. **Admin Event Injection**: Non-admin creates `/events/{id}` -> `PERMISSION_DENIED`.
9. **Weapon Config Tampering**: Non-admin modifies `/gameConfig/balance` -> `PERMISSION_DENIED`.
10. **Report Terminal Tampering**: Non-admin updates `/reports/{id}` status to `'dismissed'` -> `PERMISSION_DENIED`.
11. **ID Poisoning**: Create `/matches/../../evil` or 200-char ID -> `PERMISSION_DENIED`.
12. **Denial-of-Wallet String Bloat**: Update `/users/{uid}` with `username` > 24 chars or `unlockedItems` > 100 items -> `PERMISSION_DENIED`.
