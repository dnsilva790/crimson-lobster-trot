import { ImportedCard } from "@/lib/types";

const CARD_DATABASE_STORAGE_KEY = "card_database_reference_cards";

/**
 * Carrega todos os cards de referência do localStorage.
 * @returns Um array de objetos ImportedCard.
 */
export const getImportedCards = (): ImportedCard[] => {
  try {
    const storedCards = localStorage.getItem(CARD_DATABASE_STORAGE_KEY);
    return storedCards ? JSON.parse(storedCards) : [];
  } catch (error) {
    console.error("Falha ao carregar cards de referência do localStorage", error);
    return [];
  }
};

/**
 * Salva a lista completa de cards de referência no localStorage.
 * @param cards O array de cards a ser salvo.
 */
export const saveImportedCards = (cards: ImportedCard[]): void => {
  try {
    localStorage.setItem(CARD_DATABASE_STORAGE_KEY, JSON.stringify(cards));
  } catch (error) {
    console.error("Falha ao salvar cards de referência no localStorage", error);
  }
};

/**
 * Adiciona um novo card à lista e o salva no localStorage.
 * @param newCard O novo card a ser adicionado.
 * @returns A lista atualizada de cards.
 */
export const addImportedCard = (newCard: ImportedCard): ImportedCard[] => {
  const cards = getImportedCards();
  const updatedCards = [...cards, newCard];
  saveImportedCards(updatedCards);
  return updatedCards;
};

/**
 * Deleta um card da lista e o salva no localStorage.
 * @param cardId O ID do card a ser deletado.
 * @returns A lista atualizada de cards.
 */
export const deleteImportedCard = (cardId: string): ImportedCard[] => {
  const cards = getImportedCards();
  const updatedCards = cards.filter((card) => card.id !== cardId);
  saveImportedCards(updatedCards);
  return updatedCards;
};

/**
 * Substitui todos os cards existentes por uma nova lista.
 * @param newCards O array de novos cards.
 */
export const replaceAllImportedCards = (newCards: ImportedCard[]): void => {
  saveImportedCards(newCards);
};