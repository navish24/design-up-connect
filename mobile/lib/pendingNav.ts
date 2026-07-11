// Module-level singleton so scan.tsx can tell connections.tsx which detail to open.
// Written by scan.tsx before router.push; read+cleared by connections useFocusEffect.
let _openConnectionUserId: string | null = null;
export const getPendingConnectionOpen = () => _openConnectionUserId;
export const setPendingConnectionOpen = (userId: string | null) => {
  _openConnectionUserId = userId;
};
