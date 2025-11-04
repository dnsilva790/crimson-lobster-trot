"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Upload, Trash2, ExternalLink, RotateCcw, Database } from "lucide-react";
import { ImportedCard } from "@/lib/types";
import { getImportedCards, deleteImportedCard, replaceAllImportedCards } from "@/utils/cardDatabaseStorage";
import { toast } from "sonner";
import ExcelImporter from "@/components/ExcelImporter";
import { cn } from "@/lib/utils";

const CardDatabase = () => {
  const [cards, setCards] = useState<ImportedCard[]>([]);
  const [filteredCards, setFilteredCards] = useState<ImportedCard[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const loadCards = useCallback(() => {
    const loadedCards = getImportedCards();
    setCards(loadedCards);
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  useEffect(() => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filtered = cards.filter(
      (card) =>
        card.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        card.description?.toLowerCase().includes(lowerCaseSearchTerm) ||
        card.link.toLowerCase().includes(lowerCaseSearchTerm)
    );
    setFilteredCards(filtered);
  }, [searchTerm, cards]);

  const handleImport = useCallback((newCards: ImportedCard[]) => {
    replaceAllImportedCards(newCards);
    setCards(newCards);
  }, []);

  const handleDeleteCard = useCallback((cardId: string) => {
    if (confirm("Tem certeza que deseja excluir este card?")) {
      const updatedCards = deleteImportedCard(cardId);
      setCards(updatedCards);
      toast.success("Card excluído com sucesso!");
    }
  }, []);

  const handleClearAll = useCallback(() => {
    if (confirm("Tem certeza que deseja excluir TODOS os cards de referência?")) {
      replaceAllImportedCards([]);
      setCards([]);
      toast.success("Base de dados de cards limpa!");
    }
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-3xl font-bold mb-2 text-gray-800">
        <Database className="inline-block h-8 w-8 mr-2 text-indigo-600" /> Base de Cards de Referência
      </h2>
      <p className="text-lg text-gray-600 mb-6">
        Importe e gerencie cards de referência (links, documentos, etc.) para anexar às suas tarefas.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ExcelImporter onImport={handleImport} />
          
          <Card className="mt-6 p-6">
            <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" /> Gerenciamento
            </CardTitle>
            <div className="grid gap-4">
              <Button onClick={handleClearAll} variant="destructive" className="w-full flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Limpar Todos os Cards ({cards.length})
              </Button>
              <Button onClick={loadCards} variant="outline" className="w-full flex items-center gap-2">
                <RotateCcw className="h-4 w-4" /> Recarregar do Local Storage
              </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="p-6">
            <CardTitle className="text-xl font-bold mb-4">
              Cards Atuais ({filteredCards.length} de {cards.length})
            </CardTitle>
            <div className="relative mb-4">
              <Input
                id="card-search"
                type="text"
                placeholder="Buscar cards por nome ou link..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            </div>

            <div className="space-y-3 h-[calc(100vh-350px)] overflow-y-auto pr-2">
              {filteredCards.length > 0 ? (
                filteredCards.map((card) => (
                  <div
                    key={card.id}
                    className="p-3 border rounded-lg bg-white shadow-sm flex items-start justify-between hover:shadow-md transition-shadow"
                  >
                    <div className="flex-grow pr-4">
                      <h4 className="font-semibold text-gray-800">{card.name}</h4>
                      {card.description && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{card.description}</p>
                      )}
                      <a
                        href={card.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1"
                      >
                        {card.link.length > 50 ? card.link.substring(0, 50) + '...' : card.link}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCard(card.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center p-8 text-gray-500">
                  Nenhum card encontrado. Importe um arquivo Excel para começar.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CardDatabase;