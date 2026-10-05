export const DEFAULT_TEMPLATE = String.raw`\documentclass[letterpaper,10pt]{article}

\usepackage[utf8]{inputenc}
\usepackage[margin=0.5in]{geometry}
\usepackage{enumitem}
\usepackage{hyperref}
\usepackage{titlesec}
\usepackage{xcolor}
\usepackage{fontawesome5}

\definecolor{primary}{RGB}{0, 51, 102}
\definecolor{textdark}{RGB}{30, 30, 30}

\hypersetup{
    colorlinks=true,
    linkcolor=primary,
    urlcolor=primary,
}
\pagestyle{empty}
\urlstyle{same}

\titleformat{\section}
  {\Large\bfseries\color{primary}\raggedright}
  {}{0em}{}
  [\titlerule]
\titlespacing*{\section}{0pt}{8pt}{6pt}

\setlist[itemize]{leftmargin=12pt, itemsep=2pt, parsep=0pt, topsep=2pt}

\begin{document}

\begin{center}
    {\Huge \bfseries Devang Sharma}\\[4pt]
    \small 
    Bhopal, MP, India \ \textperiodcentered\ \ 
    \faPhone\ +91 XXXXXXXXXX \ \textperiodcentered\ \ 
    \faEnvelope\ \href{mailto:email@example.com}{email@example.com} \\[2pt]
    \faLinkedin\ \href{https://linkedin.com/in/username}{linkedin.com/in/username} \ \textperiodcentered\ \ 
    \faGithub\ \href{https://github.com/username}{github.com/username}
\end{center}

\vspace{-6pt}

\section{Technical Skills}
\begin{itemize}[leftmargin=0pt, label={}]
    \item \textbf{Languages:} Java, SQL, JavaScript, TypeScript, C
    \item \textbf{Backend \& Frameworks:} Spring Boot, Spring Security, RESTful APIs, Node.js, Express.js, Microservices
    \item \textbf{Mobile \& Frontend:} React Native, React.js, Redux Toolkit, Zustand, HTML5, CSS3, Tailwind CSS
    \item \textbf{Databases \& Cloud:} PostgreSQL, MongoDB, Supabase, Redis, AWS (EC2), Docker, Git, GitHub Actions
\end{itemize}

\section{Experience}

\noindent
\textbf{Java Backend Intern} \hfill \textit{Sep 2026 -- Present} \\
\textit{YuvaIntern} \hfill \textit{Remote}
\begin{itemize}
    \item Developed and maintained high-throughput RESTful microservices using Java 17 and Spring Boot.
    \item Optimized database queries and persistence layers in PostgreSQL, reducing average endpoint latency.
    \item Integrated automated API test suites and managed continuous integration pipelines via GitHub Actions.
\end{itemize}

\section{Projects}

\noindent
\textbf{SpringAuthKit} \textperiodcentered\ \ \textit{Java, Spring Boot, JWT, Maven} \hfill \href{https://github.com/username/project}{\faGithub\ [GitHub]}
\begin{itemize}
    \item Designed and published an open-source, reusable Spring Boot starter library for automated authentication.
    \item Provided configurable JWT validation and flexible role-based access control (RBAC) setup out of the box.
\end{itemize}

\section{Education}

\noindent
\textbf{Rajiv Gandhi Proudyogiki Vishwavidyalaya} \hfill Bhopal, India \\
\textit{Bachelor of Technology in Computer Science and Engineering} \hfill \textit{2024 -- Expected 2027}

\end{document}`;
