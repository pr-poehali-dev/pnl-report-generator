import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, formatMoney } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, User, Sparkles, TrendingUp, BarChart2, PieChart, Lightbulb, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

const QUICK_PROMPTS = [
  { icon: TrendingUp, text: "Как дела с прибылью?", label: "Анализ прибыли" },
  { icon: BarChart2, text: "Покажи структуру расходов", label: "Расходы" },
  { icon: PieChart, text: "Какая у меня маржинальность?", label: "Маржа" },
  { icon: Lightbulb, text: "Дай советы по оптимизации бизнеса", label: "Советы" },
  { icon: TrendingUp, text: "Сравни выручку с расходами", label: "Анализ" },
  { icon: Sparkles, text: "Что нужно улучшить в P&L?", label: "Улучшения" },
];

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  // Parse markdown-like formatting
  const formatContent = (text: string) => {
    return text
      .split("\n")
      .map((line, i) => {
        // Bold **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <span key={i}>
            {parts.map((part, j) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
            {i < text.split("\n").length - 1 && <br />}
          </span>
        );
      });
  };

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-violet-600 text-white rounded-tr-sm"
          : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
      )}>
        {formatContent(msg.content)}
        {msg.created_at && (
          <div className={cn("text-xs mt-1.5", isUser ? "text-violet-200" : "text-gray-400")}>
            {format(new Date(msg.created_at), "HH:mm", { locale: ru })}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0 mt-1">
          <User className="w-4 h-4 text-gray-500" />
        </div>
      )}
    </div>
  );
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history
  const { data: history, isLoading } = useQuery({
    queryKey: ["ai-history"],
    queryFn: api.getAIChatHistory,
    staleTime: 5000,
  });

  useEffect(() => {
    if (history && Array.isArray(history)) {
      setMessages(history as ChatMessage[]);
    }
  }, [history]);

  const sendMutation = useMutation({
    mutationFn: (message: string) => api.sendAIMessage(message),
    onMutate: (message) => {
      const userMsg: ChatMessage = { role: "user", content: message, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);
    },
    onSuccess: (data: unknown) => {
      const reply = (data as { reply: string }).reply;
      const aiMsg: ChatMessage = { role: "assistant", content: reply, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    },
    onError: () => {
      setIsTyping(false);
      const errMsg: ChatMessage = {
        role: "assistant",
        content: "Извините, произошла ошибка. Попробуйте ещё раз.",
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errMsg]);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-violet-600" />
            ИИ-ассистент
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Финансовый советник на основе ваших данных P&L</p>
        </div>
        <Badge className="bg-violet-100 text-violet-700 border-violet-200 gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          GPT-4o mini
        </Badge>
      </div>

      <div className="flex-1 flex gap-5 min-h-0">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4" id="chat-messages">
              {!hasMessages && !isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-violet-200">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Привет! Я ваш финансовый ассистент</h3>
                  <p className="text-sm text-gray-500 max-w-md leading-relaxed">
                    Я анализирую данные вашего P&L и даю советы по улучшению финансовых показателей.
                    Задайте мне любой вопрос о вашем бизнесе.
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-2 max-w-sm w-full">
                    {QUICK_PROMPTS.slice(0, 4).map((p, i) => (
                      <button
                        key={i}
                        onClick={() => { setInput(p.text); inputRef.current?.focus(); }}
                        className="text-left px-3 py-2.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl text-xs text-violet-700 font-medium transition-colors"
                      >
                        {p.text}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <MessageBubble key={i} msg={msg} />
                  ))}
                  {isTyping && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </CardContent>

            {/* Input */}
            <div className="border-t border-gray-100 p-3">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Задайте вопрос о финансах вашего бизнеса..."
                  className="flex-1 h-11 text-sm"
                  disabled={sendMutation.isPending}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || sendMutation.isPending}
                  className="h-11 w-11 p-0 bg-violet-600 hover:bg-violet-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Quick prompts sidebar */}
        <div className="w-64 flex-shrink-0 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Быстрые вопросы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => { sendMutation.mutate(p.text); }}
                  disabled={sendMutation.isPending}
                  className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-violet-50 hover:border-violet-200 border border-gray-200 transition-all text-xs font-medium text-gray-700 hover:text-violet-700 disabled:opacity-50"
                >
                  <p.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  {p.label}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Возможности</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-gray-500">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                Анализ P&L на основе реальных данных
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                Советы по снижению расходов
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                Анализ маржинальности
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                Сравнение доходов и расходов
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                Прогнозы и рекомендации
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
