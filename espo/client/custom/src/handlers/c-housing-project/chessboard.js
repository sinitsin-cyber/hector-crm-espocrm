// Кнопка «Шахматка» на карточке проекта: открывает шахматку этого проекта.
define('custom:handlers/c-housing-project/chessboard', [], () => {

    return class {

        constructor(view) {
            this.view = view;
        }

        open() {
            const id = this.view.model.id;

            this.view.getRouter().navigate('#CProperty/chessboard/projectId=' + id, {trigger: true});
        }
    };
});
