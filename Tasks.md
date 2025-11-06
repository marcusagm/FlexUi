# Tasks

## Layout

- [x] Deve ter o tema escuro, semelhante ao photoshop.
- [x] A distância entre cada painel e coluna é de 3px
- [x] Deve ser baseado em tons de cinza escuro
- [x] Um tom secudário a ser usado deve ser a cor #00ffcc ou variações, deve ser usado para indicadores de interação com o usuário, estado hover em menus , handlers e outros elementos, etc.
- [x] Textos devem ter a cor #ccc assim como icone de ações ativos;
- [x] Icones inativos devem ser mais escuros;
- [x] Não utilize sombras no layout quando não houver interação, apenas na representação do painel ao estar sendo arrastado.

## Menus

- [x] O menu terá os seguintes itens e subitens:

* Paineis
    - Adicionar novo painel: Adiciona um novo painel na primeira coluna no topo
* Container
    - Salvar estado atual: Salva no local store o estado atual do container guardando as informações das colunas e paineis, como quais paineis são, posição e tamanho.
    - Restaurar estado: Volta para o estado inicial da interface.

- [x] Permitir submenus multi nível

## Paineis

- [x] Deve ter um título e um conteúdo, ambos atributos da classe que devem ser recebidos no construtor.
- [x] O layout do painel é composto po um cabeçalho, uma area para o corpo do painel e um handler de redimencionamento na parte inferior;
- [x] O handler de redimencionamento deve 3px em um tom mais escuro, e ao passar o mouse deve alterar a cor para a cor de hover e mudar o cursor deve alterar para row-resize;
- [x] No cabeçalho do painel deve ter um handle para reposicionar o painel, o título e o botão para colapsar, e outro para fechar o painel, nesta ordem;
- [x] O handler de reposicionar o painel ao passar o mouse deve ficar com o cursor grab, e ao iniciar o arraste deve mudar para grabbing
- [x] O corpo do painel deve apresentar o conteúdo informado no construtor. Defina uma classe para conteúdo de panel, pois o conteúdo poderá ser personalizado com texto ou algo interativo futuramente.
- [x] Só deve ser possivel colapsar o conteúdo do painel quando estiver em uma coluna com mais de um painel e não for o único painel não colapsado, caso contrário o botão de colapse deve ser desativado.
- [x] A area de conteúdo do painel deve exibir scroll caso o conteúdo ultrapasse a altura do painel.
- [x] É possivel redimencionar a altura do painel a não ser que ele seja o único na coluna ou todos os outros paneis da mesma coluna estejam colapsados.
- [x] O painel deve ocupar a largura total da coluna.
- [x] A altura mínima do painel é de 100px caso não esteja colapsado.
- [x] Ao fechar um painel ele deve ser removido por completo.
- [ ] Agrupar paineis em abas
- [x] Possibilitar proibir paineis de serem fechados
- [x] Possibilitar proibir paineis de serem colapsados
- [x] Permitir Paineis sem título
- [ ] Paineis flutuantes
- [ ] Permitir transformar paineis flutuantes em fixos
- [ ] Permitir agrupamento de paineis flutuantes
- [ ] Paineis flutuantes colapsados em icones

## Colunas

- [x] A coluna não pode estar vazia, caso não possua nenhum painel, a coluna é removida.
- [x] Os paineis devem sempre ser destribuidos igualmente no espaço vertical da coluna, lembrando que os paineis podem ser redimencionados.
- [x] Ao redimencionar a janela, os paineis devem ser recalculados.
- [x] Caso a soma da altura dos paineis colapsados ou não seja maior que o espaço vertical da coluna, um scroll é exibido.
- [x] A largura da coluna pode ser redimencionada pelo usuário ao clicar e arrastar em umas de suas boardas laterais.
- [x] Se for a única coluna não deve permitir o redimencionamento.
- [x] Se for a primeira coluna do container, só deve permitir redimencionamento pela borda direita;
- [x] Se for a última coluna do container, só deve permitir redimencionamento pela borda esquerda;
- [x] Deve sempre ter um painel não colapsado, sendo assim se tiver apenas um painel não colapsado, o botão de colapsar desse painel deve ser desativado

## Container:

- [x] Deve ocupar todo o viewport, tanto verticalmente quanto horizontalmente, desconsiderando o espaço do menu de sistema.
- [x] Caso seja adicionado um painel e não houver colunas no container, deve ser adicionado uma para receber o novo painel.
- [ ] Permitir divisão em linhas, não apenas colunas

## Organização de paineis:

- [x] A organização será feita por um evento drag and drop
- [x] Quando um painel for reposicionado se adaptara a nova coluna, não precisando manter a altura caso tenha sido redimencionado anteriormente.
- [x] O evento drag só deve ser iniciado em um handler de reposicionamento de um painel.
- [x] Deve permitir a reordenação de paineis dentro da mesma coluna, exibindo um indicador de posição quando o mouse ficar entre um painel e outro, ou no topo da coluna ou na parte inferior da coluna.
- [x] O indicador de posição dentro da coluna deve ser uma barra de 3px sem padding ou margin, encaixando exatamente entre os paineis ou espaço do topo ou parte inferior da coluna
- [x] Deve permitir mudar um painel de coluna, colocando na ordem entre paineis indicada pelo cursor do mouse;
- [x] Deve permitir mudar para uma nova coluna ao mover para o espaço entre as colunas, onde irá aparecer um indicador de posição.
- [x] Indicadores visuais sutis, sem afetar layout.
- [x] Inserção precisa com base na posição do mouse;
- [x] Detectar com precisão a posição do mouse para inserir painéis entre outros painéis ou em novas colunas;

## Outros

- [x] Barra de status
- [x] Sistemas de notificação
- [x] Sistema de tradução
- [x] Bloqueio da tela abaixo
- [x] Telas de confirmação
- [ ] Sistema de atalhos de teclado

# Melhorar o CONTRIBUTING.md

- https://mozillascience-github-io.translate.goog/working-open-workshop/contributing/?_x_tr_sch=http&_x_tr_sl=en&_x_tr_tl=pt&_x_tr_hl=pt&_x_tr_pto=tc
- https://github-com.translate.goog/atom/atom/blob/master/CONTRIBUTING.md?_x_tr_sl=en&_x_tr_tl=pt&_x_tr_hl=pt&_x_tr_pto=tc
- https://docs.github.com/pt/communities/setting-up-your-project-for-healthy-contributions/setting-guidelines-for-repository-contributors
- https://github.com/iuricode/readme-template
- https://github.com/iuricode/padroes-de-commits
- https://gist.github.com/jakebrinkmann/c63eaedbe384516e4a7bc133c1e1066b

# To fix
