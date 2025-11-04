"use client";

import React, { useState, useCallback } from "react";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ImportedCard } from "@/lib/types";

interface ExcelImporterProps {
  onImport: (cards: ImportedCard[]) => void;
}

const ExcelImporter: React.FC<ExcelImporterProps> = ({ onImport }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const handleImport = useCallback(() => {
    if (!file) {
      toast.error("Por favor, selecione um arquivo Excel (.xlsx ou .xls).");
      return;
    }

    setIsLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converte a planilha para JSON, usando a primeira linha como cabeçalho
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) {
          toast.error("O arquivo Excel está vazio ou não tem dados suficientes.");
          setIsLoading(false);
          return;
        }

        const headers = json[0] as string[];
        const dataRows = json.slice(1);

        // Mapeamento de colunas esperado (case-insensitive)
        const nameIndex = headers.findIndex(h => h.toLowerCase().includes('nome') || h.toLowerCase().includes('card'));
        const linkIndex = headers.findIndex(h => h.toLowerCase().includes('link') || h.toLowerCase().includes('url'));
        const descriptionIndex = headers.findIndex(h => h.toLowerCase().includes('descrição') || h.toLowerCase().includes('description'));

        if (nameIndex === -1 || linkIndex === -1) {
          toast.error("O arquivo deve conter colunas 'Nome' e 'Link'. Verifique o cabeçalho.");
          setIsLoading(false);
          return;
        }

        const importedCards: ImportedCard[] = dataRows.map((row: any[], index) => {
          const name = row[nameIndex] ? String(row[nameIndex]).trim() : `Card Sem Nome ${index + 1}`;
          const link = row[linkIndex] ? String(row[linkIndex]).trim() : '#';
          const description = descriptionIndex !== -1 && row[descriptionIndex] ? String(row[descriptionIndex]).trim() : undefined;

          return {
            id: Date.now().toString() + index, // Garante ID único
            name,
            link,
            description,
            createdAt: new Date().toISOString(),
          };
        }).filter(card => card.name && card.link); // Filtra cards inválidos

        if (importedCards.length === 0) {
          toast.error("Nenhum card válido encontrado após a leitura.");
          setIsLoading(false);
          return;
        }

        onImport(importedCards);
        toast.success(`Importados ${importedCards.length} cards com sucesso!`);
        setFile(null);
      } catch (error) {
        console.error("Erro ao processar o arquivo Excel:", error);
        toast.error("Erro ao processar o arquivo. Certifique-se de que é um formato Excel válido.");
      } finally {
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      toast.error("Falha ao ler o arquivo.");
      setIsLoading(false);
    };

    reader.readAsBinaryString(file);
  }, [file, onImport]);

  return (
    <Card className="p-6">
      <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
        <Upload className="h-5 w-5 text-indigo-600" /> Importar Cards de Excel
      </CardTitle>
      <div className="grid gap-4">
        <div>
          <Label htmlFor="excel-file" className="text-gray-700">
            Selecione o arquivo (.xlsx, .xls)
          </Label>
          <Input
            id="excel-file"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="mt-1"
            disabled={isLoading}
          />
        </div>
        {file && (
          <div className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
            <span className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> {file.name}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
              <XCircle className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        )}
        <Button 
          onClick={handleImport} 
          disabled={!file || isLoading}
          className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
        >
          {isLoading ? (
            <LoadingSpinner size={20} className="text-white" />
          ) : (
            <>
              <Upload className="h-4 w-4" /> Carregar e Substituir Base
            </>
          )}
        </Button>
        <p className="text-xs text-gray-500 mt-1">
          **Atenção:** A importação substituirá todos os cards de referência existentes.
          O arquivo deve ter as colunas 'Nome' e 'Link' na primeira aba.
        </p>
      </div>
    </Card>
  );
};

export default ExcelImporter;