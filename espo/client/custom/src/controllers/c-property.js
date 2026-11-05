// Контроллер объектов: штатный record-контроллер плюс страница шахматки
// по адресу #CProperty/chessboard (или #CProperty/chessboard/projectId=<id>).
define('custom:controllers/c-property', ['controllers/record'], (RecordController) => {

    return class extends RecordController {

        actionChessboard(options) {
            options = options || {};

            this.main('custom:views/c-property/chessboard', {
                projectId: options.projectId || null,
            });
        }
    };
});
