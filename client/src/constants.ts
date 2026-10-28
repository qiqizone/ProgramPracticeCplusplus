export interface ChapterMeta {
  id: number;
  title: string;
  desc: string;
}

export const CHAPTERS: ChapterMeta[] = [
  { id: 1, title: '基础语法', desc: '变量、类型、运算符、流程控制' },
  { id: 2, title: '函数与字符串', desc: '函数、重载、数组、std::string' },
  { id: 3, title: '指针与内存', desc: '指针、引用、new/delete、RAII' },
  { id: 4, title: '面向对象', desc: '类、继承、多态、虚函数、析构' },
  { id: 5, title: 'STL', desc: '容器、迭代器、算法、lambda' },
  { id: 6, title: '现代 C++', desc: 'auto、智能指针、移动语义、模板' },
  { id: 7, title: '异常处理', desc: 'throw/catch、栈展开、noexcept、异常安全' },
  { id: 8, title: '输入输出与文件', desc: 'iostream、格式化、文件流、std::filesystem' },
  { id: 9, title: '并发与线程', desc: '线程、互斥量、条件变量、原子与 async' },
  { id: 10, title: '模板进阶与 C++20', desc: '特化、可变参数、concepts、ranges' },
];

export const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export const TYPE_LABEL: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  output: '读代码写输出',
  code: '编程题',
};
