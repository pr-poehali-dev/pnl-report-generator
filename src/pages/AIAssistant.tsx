import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Send, User, Sparkles, TrendingUp, BarChart2, PieChart,
  Lightbulb, RefreshCw, Trash2, Target, DollarSign, Copy, Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

const QUICK_PROMPTS = [
  { icon: DollarSign, text: "Как дела с чистой прибылью?", label: "Прибыль", color: "violet" },
  { icon: BarChart2, text: "Покажи структуру расходов", label: "Расходы", color: "red" },
  { icon: PieChart, text: "Какая у меня маржинальность?", label: "Маржа", color: "blue" },
  { icon: Lightbulb, text: "Дай советы по оптимизации бизнеса", label: "Советы", color: "amber" },
  { icon: TrendingUp, text: "Анализ выручки и доходов", label: "Доходы", color: "green" },
  { icon: Target, text: "Рассчитай точку безубыточности", label: "Безубыточность", color: "pink" },
];

function formatContent(text: string) {
  return text.split("\n").map((line, i, arr) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex gap-3 group", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div className="relative max-w-[82%]">
        <div className={cn(
          "rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-violet-600 text-white rounded-tr-sm shadow-sm"
            : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
        )}>
          {formatContent(msg.content)}
          {msg.created_at && (
            <div className={cn("text-[11px] mt-1.5", isUser ? "text-violet-200" : "text-gray-400")}>
              {format(new Date(msg.created_at), "HH:mm", { locale: ru })}
            </div>
          )}
        </div>
        {!isUser && (
          <button
            onClick={handleCopy}
            className="absolute -bottom-5 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 p-0.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
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
  const queryClient = useQueryClient();

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
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Извините, произошла ошибка. Попробуйте ещё раз.",
        created_at: new Date().toISOString()
      }]);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => api.clearAIChatHistory(),
    onSuccess: () => {
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ["ai-history"] });
      toast.success("История очищена");
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

  const handleQuickPrompt = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-violet-600" />
            ИИ-ассистент
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Финансовый советник на основе ваших данных P&L</p>
        </div>
        <div className="flex items-center gap-2">
          {hasMessages && (
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
              onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
              <Trash2 className="w-3.5 h-3.5" />
              Очистить
            </Button>
          )}
          <Badge className="bg-violet-100 text-violet-700 border-violet-200 gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            GPT-4o mini
          </Badge>
        </div>
      </div>

      <div className="flex-1 flex gap-5 min-h-0">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-gray-200">
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {!hasMessages && !isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center mb-4 shadow-lg shadow-violet-200">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Привет! Я ваш финансовый ассистент</h3>
                  <p className="text-sm text-gray-500 max-w-md leading-relaxed">
                    Анализирую данные P&L и помогаю принимать финансовые решения.
                    Задайте вопрос о прибыли, расходах или попросите совет!
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-2 max-w-sm w-full">
                    {QUICK_PROMPTS.slice(0, 4).map((p, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickPrompt(p.text)}
                        className="text-left px-3 py-2.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-xl text-xs text-violet-700 font-medium transition-colors leading-snug"
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
                        <div className="flex gap-1.5 items-center h-4">
                          <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </CardContent>

            {/* Input */}
            <div className="border-t border-gray-100 p-3 bg-white/80 backdrop-blur-sm">
              {/* Quick prompts strip */}
              {!hasMessages && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                  {QUICK_PROMPTS.map((p, i) => (
                    <button key={i} onClick={() => handleQuickPrompt(p.text)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-violet-50 hover:text-violet-700 border border-transparent hover:border-violet-200 rounded-xl text-xs text-gray-600 whitespace-nowrap transition-all flex-shrink-0">
                      <p.icon className="w-3 h-3" />
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Спросите о прибыли, расходах, марже..."
                  className="flex-1 h-10 text-sm border-gray-200 focus:border-violet-300 rounded-xl"
                  disabled={sendMutation.isPending}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || sendMutation.isPending}
                  size="sm"
                  className="h-10 w-10 p-0 bg-violet-600 hover:bg-violet-700 rounded-xl flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                Ответы основаны на ваших данных P&L • Enter для отправки
              </p>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 hidden lg:flex flex-col gap-4">
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Быстрые вопросы</p>
              <div className="space-y-1.5">
                {QUICK_PROMPTS.map((p, i) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => handleQuickPrompt(p.text)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-gray-600 hover:bg-violet-50 hover:text-violet-700 rounded-xl transition-colors group"
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0 text-gray-400 group-hover:text-violet-500" />
                      <span className="leading-snug">{p.text}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Возможности</p>
              <div className="space-y-2.5">
                {[
                  { icon: "📊", text: "Анализ P&L-данных в реальном времени" },
                  { icon: "💡", text: "Рекомендации по улучшению прибыльности" },
                  { icon: "📐", text: "Расчёт точки безубыточности" },
                  { icon: "📈", text: "Оценка маржинальности" },
                  { icon: "🎯", text: "Сравнение с бенчмарками отрасли" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-500">
                    <span>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-semibold text-violet-700">GPT-4o mini</span>
            </div>
            <p className="text-xs text-violet-600 leading-relaxed">
              ИИ-ассистент обучен финансовому анализу и понимает контекст вашего бизнеса.
            </p>
            <div className="mt-2 text-[10px] text-violet-400">
              Тариф Бизнес: 50 запросов/мес<br />
              Тариф Про: неограниченно
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
