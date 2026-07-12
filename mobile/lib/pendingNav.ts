// Module-level singletons so scan.tsx and home screen can tell connections.tsx which detail to open.
// Written before router.push; read+cleared by connections useFocusEffect.
let _openConnectionUserId: string | null = null;
export const getPendingConnectionOpen = () => _openConnectionUserId;
export const setPendingConnectionOpen = (userId: string | null) => {
  _openConnectionUserId = userId;
};

let _openCardId: string | null = null;
export const getPendingCardOpen = () => _openCardId;
export const setPendingCardOpen = (cardId: string | null) => {
  _openCardId = cardId;
};
