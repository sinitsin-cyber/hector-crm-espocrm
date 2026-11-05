// Нижняя панель «Шахматка» в карточке проекта: та же шахматка, что на отдельной
// странице, но без заголовка и выбора проекта.
define('custom:views/c-housing-project/panels/chessboard', ['views/record/panels/bottom'], (BottomPanelView) => {

    return class extends BottomPanelView {

        templateContent = `<div class="cb-panel-container">{{{chessboard}}}</div>`;

        setup() {
            super.setup();

            this.createView('chessboard', 'custom:views/c-property/chessboard', {
                selector: '.cb-panel-container',
                projectId: this.model.id,
                model: this.model,
                embedded: true,
            });

            // Поменяли параметры дома — обновить сетку.
            this.listenTo(this.model, 'after:save', () => this.model.trigger('cb:refresh'));
        }
    };
});
