"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Mail, Archive, Trash2, CheckCircle, Eye, ExternalLink, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Email {
  id: string;
  sender: string;
  subject: string;
  bodyPreview: string;
  receivedDateTime: string;
  isRead: boolean;
  category: string | null;
  url: string;
}

const mockEmails: Email[] = [
  {
    id: "1",
    sender: "suporte@empresa.com",
    subject: "Seu pedido #12345 foi enviado!",
    bodyPreview: "Olá, seu pedido foi enviado e deve chegar em breve...",
    receivedDateTime: subDays(new Date(), 0).toISOString(),
    isRead: false,
    category: null,
    url: "https://outlook.live.com/",
  },
  {
    id: "2",
    sender: "marketing@loja.com",
    subject: "Oferta imperdível: 50% de desconto!",
    bodyPreview: "Não perca nossas promoções exclusivas...",
    receivedDateTime: subDays(new Date(), 1).toISOString(),
    isRead: false,
    category: null,
    url: "https://outlook.live.com/",
  },
  {
    id: "3",
    sender: "chefe@empresa.com",
    subject: "Reunião de equipe amanhã",
    bodyPreview: "Lembrete: nossa reunião semanal será amanhã às 10h...",
    receivedDateTime: subDays(new Date(), 0).toISOString(),
    isRead: false,
    category: "Importante",
    url: "https://outlook.live.com/",
  },
  {
    id: "4",
    sender: "notificacoes@social.com",
    subject: "Você tem novas notificações!",
    bodyPreview: "Alguém comentou na sua publicação...",
    receivedDateTime: subDays(new Date(), 2).toISOString(),
    isRead: true,
    category: null,
    url: "https://outlook.live.com/",
  },
  {
    id: "5",
    sender: "financeiro@empresa.com",
    subject: "Fatura de Janeiro",
    bodyPreview: "Segue em anexo a fatura referente ao mês de janeiro...",
    receivedDateTime: subDays(new Date(), 0).toISOString(),
    isRead: false,
    category: "Urgente",
    url: "https://outlook.live.com/",
  },
];

const EmailTriage = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  const handleConnectOutlook = useCallback(() => {
    // Simula a conexão com o Outlook
    setIsConnected(true);
    setEmails(mockEmails);
    toast.success("Conectado ao Outlook (simulado) com sucesso!");
  }, []);

  const handleMarkAsRead = useCallback((id: string) => {
    setEmails(prev => prev.map(email => email.id === id ? { ...email, isRead: true } : email));
    toast.info("E-mail marcado como lido (simulado).");
    if (selectedEmail?.id === id) {
      setSelectedEmail(prev => prev ? { ...prev, isRead: true } : null);
    }
  }, [selectedEmail]);

  const handleArchive = useCallback((id: string) => {
    setEmails(prev => prev.filter(email => email.id !== id));
    toast.success("E-mail arquivado (simulado).");
    if (selectedEmail?.id === id) {
      setSelectedEmail(null);
    }
  }, [selectedEmail]);

  const handleDelete = useCallback((id: string) => {
    setEmails(prev => prev.filter(email => email.id !== id));
    toast.error("E-mail excluído (simulado).");
    if (selectedEmail?.id === id) {
      setSelectedEmail(null);
    }
  }, [selectedEmail]);

  const handleCategorize = useCallback((id: string, category: string) => {
    setEmails(prev => prev.map(email => email.id === id ? { ...email, category } : email));
    toast.info(`E-mail categorizado como '${category}' (simulado).`);
    if (selectedEmail?.id === id) {
      setSelectedEmail(prev => prev ? { ...prev, category } : null);
    }
  }, [selectedEmail]);

  const filteredEmails = emails.filter(email =>
    email.subject.toLowerCase().includes(filter.toLowerCase()) ||
    email.sender.toLowerCase().includes(filter.toLowerCase()) ||
    email.bodyPreview.toLowerCase().includes(filter.toLowerCase())
  ).sort((a, b) => parseISO(b.receivedDateTime).getTime() - parseISO(a.receivedDateTime).getTime());

  const renderEmailItem = (email: Email) => (
    <div
      key={email.id}
      className={cn(
        "flex flex-col p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50",
        email.isRead ? "bg-gray-50 text-gray-600" : "bg-white text-gray-800 font-semibold",
        selectedEmail?.id === email.id && "bg-blue-50 border-blue-400 ring-1 ring-blue-400"
      )}
      onClick={() => setSelectedEmail(email)}
    >
      <div className="flex justify-between items-center">
        <span className="text-sm font-bold">{email.sender}</span>
        <span className="text-xs text-gray-500">
          {format(parseISO(email.receivedDateTime), "dd/MM HH:mm", { locale: ptBR })}
        </span>
      </div>
      <p className="text-md mt-1">{email.subject}</p>
      <p className="text-sm text-gray-500 line-clamp-1">{email.bodyPreview}</p>
      {email.category && (
        <span className="mt-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs rounded-full self-start">
          {email.category}
        </span>
      )}
    </div>
  );

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <h2 className="text-3xl font-bold mb-2 text-gray-800">
          <Mail className="inline-block h-8 w-8 mr-2 text-indigo-600" /> TRIAGEM DE E-MAILS
        </h2>
        <p className="text-lg text-gray-600 mb-6">
          Conecte seu Outlook e trie seus e-mails de forma eficiente.
        </p>

        <Card className="mb-6 p-6">
          <CardTitle className="text-xl font-bold mb-4 flex items-center gap-2">
            <Plug className="h-5 w-5 text-indigo-600" /> Conectar Outlook
          </CardTitle>
          <CardContent className="grid gap-4">
            {!isConnected ? (
              <Button onClick={handleConnectOutlook} className="w-full py-3 text-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2">
                <Plug className="h-5 w-5" /> Conectar ao Outlook
              </Button>
            ) : (
              <p className="text-green-600 font-semibold flex items-center gap-2">
                <CheckCircle className="h-5 w-5" /> Conectado com sucesso!
              </p>
            )}
          </CardContent>
        </Card>

        {isConnected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Mail className="h-5 w-5 text-indigo-600" /> Caixa de Entrada
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-3 border-b border-gray-200">
                <Input
                  placeholder="Filtrar e-mails..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full"
                />
              </div>
              <ScrollArea className="h-[calc(100vh-550px)]">
                {filteredEmails.length > 0 ? (
                  filteredEmails.map(renderEmailItem)
                ) : (
                  <p className="p-4 text-center text-gray-500">Nenhum e-mail encontrado.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:col-span-2">
        {selectedEmail ? (
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-gray-800">{selectedEmail.subject}</CardTitle>
              <p className="text-sm text-gray-600">De: <span className="font-semibold">{selectedEmail.sender}</span></p>
              <p className="text-xs text-gray-500">Recebido em: {format(parseISO(selectedEmail.receivedDateTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
              {selectedEmail.category && (
                <span className="mt-2 px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-sm rounded-full self-start">
                  {selectedEmail.category}
                </span>
              )}
            </CardHeader>
            <CardContent className="flex-grow overflow-y-auto border-t p-6">
              <p className="whitespace-pre-wrap text-gray-700">{selectedEmail.bodyPreview}...</p>
              <p className="mt-4 text-sm text-gray-500 italic">
                (Conteúdo completo do e-mail seria exibido aqui em uma integração real)
              </p>
            </CardContent>
            <div className="p-6 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button onClick={() => handleMarkAsRead(selectedEmail.id)} disabled={selectedEmail.isRead} className="bg-green-500 hover:bg-green-600 text-white flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" /> {selectedEmail.isRead ? "Lido" : "Marcar como Lido"}
              </Button>
              <Button onClick={() => handleArchive(selectedEmail.id)} className="bg-gray-500 hover:bg-gray-600 text-white flex items-center justify-center gap-2">
                <Archive className="h-4 w-4" /> Arquivar
              </Button>
              <Button onClick={() => handleDelete(selectedEmail.id)} className="bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
              <a href={selectedEmail.url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                  <ExternalLink className="h-4 w-4" /> Abrir no Outlook
                </Button>
              </a>
              <Button onClick={() => handleCategorize(selectedEmail.id, "Importante")} variant="secondary" className="flex items-center justify-center gap-2 col-span-2">
                <Eye className="h-4 w-4" /> Categorizar: Importante
              </Button>
              <Button onClick={() => handleCategorize(selectedEmail.id, "Urgente")} variant="secondary" className="flex items-center justify-center gap-2 col-span-2">
                <Eye className="h-4 w-4" /> Categorizar: Urgente
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="h-full flex items-center justify-center p-6 text-center text-gray-500">
            <p>Selecione um e-mail para visualizar e triar.</p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EmailTriage;